import test from 'ava';
import * as Koa from 'koa';
import * as request from 'supertest';
import { serve } from '../src';

test('serve(root) when defer: false', async (t) => {
    const app = new Koa();
    app.use(serve('.'));
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/package.json');
    t.is(res.status, 200, 'when root = ".", should serve from cwd');
});

test('serve(root) when defer: false', async (t) => {
    const app = new Koa();
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (e) {
            t.falsy(e, 'should not throw 404 error');
        }
    });
    app.use(serve('test/fixtures'));
    app.use(async (ctx) => {
        ctx.body = 'ok';
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/something');
    t.is(res.status, 200, 'should not return 404');
    t.deepEqual(res.text, 'ok', 'should pass to next');
});

test('serve(root) when defer: false, when upstream middleware responds', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures'));
    app.use(async (ctx, next) => {
        ctx.body = 'hey';
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/hello.txt');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'world', 'should respond');
});

test('serve(root) when defer: false, when disable index', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', {index: false}));
    app.use(async (ctx, next) => {
        ctx.body = 'oh no';
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'oh no', 'should pass to downstream if 404');
});

test('serve(root) when defer: false, when method is not `GET` or `HEAD`', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures'));

    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.post('/hello.txt');
    t.is(res.status, 404, 'should return 404');
});
// describe('serve(root)', function () {
//   describe('when defer: true', function () {
//     describe('when upstream middleware responds', function () {
//       it('should do nothing', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           defer: true
//         }))

//         app.use((ctx, next) => {
//           return next().then(() => {
//             ctx.body = 'hey'
//           })
//         })

//         request(app.listen())
//           .get('/hello.txt')
//           .expect(200)
//           .expect('hey', done)
//       })
//     })

//     describe('the path is valid', function () {
//       it('should serve the file', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           defer: true
//         }))

//         request(app.listen())
//           .get('/hello.txt')
//           .expect(200)
//           .expect('world', done)
//       })
//     })

//     describe('.index', function () {
//       describe('when present', function () {
//         it('should alter the index file supported', function (done) {
//           const app = new Koa()

//           app.use(serve('test/fixtures', {
//             defer: true,
//             index: 'index.txt'
//           }))

//           request(app.listen())
//             .get('/')
//             .expect(200)
//             .expect('Content-Type', 'text/plain; charset=utf-8')
//             .expect('text index', done)
//         })
//       })

//       describe('when omitted', function () {
//         it('should use index.html', function (done) {
//           const app = new Koa()

//           app.use(serve('test/fixtures', {
//             defer: true
//           }))

//           request(app.listen())
//             .get('/world/')
//             .expect(200)
//             .expect('Content-Type', 'text/html; charset=utf-8')
//             .expect('html index', done)
//         })
//       })
//     })

//     // describe('when path is a directory', function(){
//     //   describe('and an index file is present', function(){
//     //     it('should redirect missing / to -> / when index is found', function(done){
//     //       const app = new Koa();

//     //       app.use(serve('test/fixtures'));

//     //       request(app.listen())
//     //       .get('/world')
//     //       .expect(303)
//     //       .expect('Location', '/world/', done);
//     //     })
//     //   })

//     //   describe('and no index file is present', function(){
//     //     it('should not redirect', function(done){
//     //       const app = new Koa();

//     //       app.use(serve('test/fixtures'));

//     //       request(app.listen())
//     //       .get('/')
//     //       .expect(404, done);
//     //     })
//     //   })
//     // })

//     describe('when path is not a file', function () {
//       it('should 404', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           defer: true
//         }))

//         request(app.listen())
//           .get('/something')
//           .expect(404, done)
//       })

//       it('should not throw 404 error', function (done) {
//         const app = new Koa()

//         let err = null

//         app.use(async (ctx, next) => {
//           try {
//             await next()
//           } catch (e) {
//             err = e
//           }
//         })

//         app.use(serve('test/fixtures', {
//           defer: true
//         }))

//         request(app.listen())
//           .get('/something')
//           .expect(200)
//           .end((_, res) => {
//             assert.equal(err, null)
//             done()
//           })
//       })
//     })

//     describe('it should not handle the request', function () {
//       it('when status=204', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           defer: true
//         }))

//         app.use((ctx) => {
//           ctx.status = 204
//         })

//         request(app.listen())
//           .get('/something%%%/')
//           .expect(204, done)
//       })

//       it('when body=""', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           defer: true
//         }))

//         app.use((ctx) => {
//           ctx.body = ''
//         })

//         request(app.listen())
//           .get('/something%%%/')
//           .expect(200, done)
//       })
//     })

//     describe('when method is not `GET` or `HEAD`', function () {
//       it('should 404', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           defer: true
//         }))

//         request(app.listen())
//           .post('/hello.txt')
//           .expect(404, done)
//       })
//     })
//   })

//   describe('option - format', function () {
//     describe('when format: false', function () {
//       it('should 404', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           index: 'index.html',
//           format: false
//         }))

//         request(app.listen())
//           .get('/world')
//           .expect(404, done)
//       })

//       it('should 200', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           index: 'index.html',
//           format: false
//         }))

//         request(app.listen())
//           .get('/world/')
//           .expect(200, done)
//       })
//     })

//     describe('when format: true', function () {
//       it('should 200', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           index: 'index.html',
//           format: true
//         }))

//         request(app.listen())
//           .get('/world')
//           .expect(200, done)
//       })

//       it('should 200', function (done) {
//         const app = new Koa()

//         app.use(serve('test/fixtures', {
//           index: 'index.html',
//           format: true
//         }))

//         request(app.listen())
//           .get('/world/')
//           .expect(200, done)
//       })
//     })
//   })
// })
