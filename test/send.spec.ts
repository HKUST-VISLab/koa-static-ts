import test from 'ava';
import * as Koa from 'koa';
import * as path from 'path';
import * as request from 'supertest';
import { send } from '../src/send';

interface TestContext {
    app: Koa;
}

test.beforeEach('init app', t => {
    const app = new Koa();
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (err) {
            // will only respond with JSON
            ctx.status = err.statusCode || err.status || 500;
            ctx.response.status = ctx.status;
            ctx.body = {
                message: err.message,
            };
        }
    });
    t.context = {
        app,
    };
});

test('send with no .root', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, '');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    let res = await req.get(`/${path.join(__dirname, '/fixtures/hello.txt')}`);
    t.is(res.status, 400, 'when the path is absolute should 400');

    res = await req.get('/test/fixtures/hello.txt');
    t.is(res.status, 200, 'when the path is relative should 200');
    t.deepEqual(res.text, 'world', 'when the path is relative should get the content');

    res = await req.get('/../fixtures/hello.txt');
    t.is(res.status, 403, 'when the path contains .. should 403');
});

test('send with .root', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test/fixtures');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    let res = await req.get(`/${path.join(__dirname, '/fixtures/hello.txt')}`);
    t.is(res.status, 400, 'when the path is absolute should 400');

    res = await req.get('/hello.txt');
    t.is(res.status, 200, 'when the path is relative and file exists should 200');
    t.is(res.text, 'world', 'when the path is relative should get the content');

    res = await req.get('/hello1.txt');
    t.is(res.status, 404, 'when the path is relative and does not exist should 404');

    res = await req.get('/../../package.json');
    t.is(res.status, 403, 'when the path resolves above the root should 403');

    res = await req.get('/../../test/fixtures/world/index.html');
    t.is(res.status, 403, 'when the path resolves within root but use .. should 403');
});

test('with .index', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/world/');
    t.is(res.status, 200, 'when the index file is present should 200');
    t.deepEqual(res.text, 'html index', 'when the index file is present should serve it');

});

test('with .index path', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test/fixtures/world');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/');
    t.is(res.status, 200, 'when the index file is present should 200');
    t.deepEqual(res.text, 'html index', 'when the index file is present should serve it');
});

test('when path is not a file', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, '');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/test');
    t.is(res.status, 404, 'when path is not a file should 404');
});

test('when path is not a file', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { format: false });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/');
    t.is(res.status, 404, 'should return undefined if format is set to false');
});

test('when path is a directory', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { format: false });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures');
    t.is(res.status, 404, 'when path is a directory should 404');
});

test('when path does not finish with slash and format is disabled', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { format: false });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/world');
    t.is(res.status, 404, 'should 404');
});

test('when path does not finish with slash and format is enabled', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { format: true });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/world')
        .expect('content-type', 'text/html; charset=utf-8')
        .expect('content-length', '10');
    t.is(res.status, 200, 'should 200');
});

test('when path does not finish with slash and index is disabled', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { index: false });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/world');
    t.is(res.status, 404, 'should 404');
});

test('when path is malformed', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, '');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/%');
    t.is(res.status, 400, 'should 400');
});

test('when path is a file', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test');
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    let res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should 200');

    res = await req.get('/fixtures/gzip.json')
        .set('Accept-Encoding', 'deflate, identity');
    t.deepEqual(res.header['content-length'], '18', 'or .gz version when requested and if possible');
    t.deepEqual(res.text, '{ "name": "tobi" }', 'or .gz version when requested and if possible');
    t.is(res.status, 200, 'or .gz version when requested and if possible');
});

test('when path is a file', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test', { gzip: false });
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/gzip.json')
        .set('Accept-Encoding', 'gzip, deflate, identity');
    t.deepEqual(res.header['content-length'], '18', 'should not return .gz path when gzip option is false');
    t.deepEqual(res.text, '{ "name": "tobi" }', 'should not return .gz path when gzip option is false');
    t.is(res.status, 200, 'should not return .gz path when gzip option is false');
});

test('when path is a file', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test');
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path + '.gz'), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/gzip.json')
        .set('Accept-Encoding', 'gzip, deflate, identity');
    t.deepEqual(res.header['content-length'], '48', 'should return .gz path (gzip option defaults to true)');
    t.deepEqual(res.text, '{ "name": "tobi" }', 'should return .gz path (gzip option defaults to true)');
    t.is(res.status, 200, 'should return .gz path (gzip option defaults to true)');
});

// describe('send(ctx, file)', function () {s
//     describe('when path is a file', function () {
//         describe('or .br version when requested and if possible', function () {
//             it('should return path', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, '/test/fixtures/gzip.json')
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .set('Accept-Encoding', 'deflate, identity')
//                     .expect('Content-Length', '18')
//                     .expect('{ "name": "tobi" }')
//                     .expect(200, done)
//             })

//             it('should return .br path (brotli option defaults to true)', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, '/test/fixtures/gzip.json')
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .set('Accept-Encoding', 'br, deflate, identity')
//                     .expect('Content-Length', '22')
//                     .expect(200)
//                     .then(({ body }) => {
//                         decompress(body, (err, output) => {
//                             assert.strictEqual(err, null)
//                             assert.deepStrictEqual(output.toString(), '{ "name": "tobi" }')
//                             done()
//                         })
//                     })
//             })

//             it('should return .br path when brotli option is turned on', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, '/test/fixtures/gzip.json', { brotli: true })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .set('Accept-Encoding', 'br, deflate, identity')
//                     .expect('Content-Length', '22')
//                     .expect(200)
//                     .then(({ body }) => {
//                         decompress(body, (err, output) => {
//                             assert.strictEqual(err, null)
//                             assert.deepStrictEqual(output.toString(), '{ "name": "tobi" }')
//                             done()
//                         })
//                     })
//             })

//             it('should not return .br path when brotli option is false', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, '/test/fixtures/gzip.json', { brotli: false })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .set('Accept-Encoding', 'br, deflate, identity')
//                     .expect('Content-Length', '18')
//                     .expect('{ "name": "tobi" }')
//                     .expect(200, done)
//             })

//             it('should return .gz path when brotli option is turned off', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, '/test/fixtures/gzip.json', { brotli: false })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .set('Accept-Encoding', 'br, gzip, deflate, identity')
//                     .expect('Content-Length', '48')
//                     .expect('{ "name": "tobi" }')
//                     .expect(200, done)
//             })
//         })

//         describe('and max age is specified', function () {
//             it('should set max-age in seconds', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     const p = '/test/fixtures/user.json'
//                     const sent = await send(ctx, p, { maxage: 5000 })
//                     assert.equal(sent, path.join(__dirname, '/fixtures/user.json'))
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect('Cache-Control', 'max-age=5')
//                     .expect(200, done)
//             })

//             it('should truncate fractional values for max-age', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     const p = '/test/fixtures/user.json'
//                     const sent = await send(ctx, p, { maxage: 1234 })
//                     assert.equal(sent, path.join(__dirname, '/fixtures/user.json'))
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect('Cache-Control', 'max-age=1')
//                     .expect(200, done)
//             })
//         })

//         describe('and immutable is specified', function () {
//             it('should set the immutable directive', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     const p = '/test/fixtures/user.json';
//                     const sent = await send(ctx, p, { immutable: true, maxage: 31536000000 });
//                     assert.equal(sent, path.join(__dirname, '/fixtures/user.json'));
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect('Cache-Control', 'max-age=31536000,immutable')
//                     .expect(200, done);
//             })
//         });
//     });

//     describe('.immutable option', function () {
//         describe('when trying to get a non-existent file', function () {
//             it('should not set the Cache-Control header', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/does-not-exist.json', { immutable: true })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect((res) => {
//                         assert.equal(res.header['cache-control'], undefined)
//                     })
//                     .expect(404, done)
//             });
//         });
//     });

//     describe('.hidden option', function () {
//         describe('when trying to get a hidden file', function () {
//             it('should 404', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/.hidden')
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(404, done)
//             })
//         });

//         describe('when trying to get a file from a hidden directory', function () {
//             it('should 404', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/.private/id_rsa.txt')
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(404, done)
//             })
//         });

//         describe('when trying to get a hidden file and .hidden check is turned off', function () {
//             it('should 200', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/.hidden', { hidden: true })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(200, done)
//             })
//         });
//     });

//     describe('.extensions option', function () {
//         describe('when trying to get a file without extension with no .extensions sufficed', function () {
//             it('should 404', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/hello')
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(404, done)
//             })
//         });

//         describe('when trying to get a file without extension with no matching .extensions', function () {
//             it('should 404', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/hello', { extensions: ['json', 'htm', 'html'] })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(404, done)
//             })
//         });

//         describe('when trying to get a file without extension with non array .extensions', function () {
//             it('should 404', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/hello', { extensions: {} })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(404, done)
//             })
//         });

//         describe('when trying to get a file without extension with non string array .extensions', function () {
//             it('throws if extensions is not array of strings', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/hello', { extensions: [2, {}, []] })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(500)
//                     .end(done)
//             })
//         });

//         describe('when trying to get a file without extension with matching .extensions sufficed first matched should be sent', function () {
//             it('should 200 and application/json', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/user', { extensions: ['html', 'json', 'txt'] })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(200)
//                     .expect('Content-Type', /application\/json/)
//                     .end(done)
//             })
//         });

//         describe('when trying to get a file without extension with matching .extensions sufficed', function () {
//             it('should 200', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/hello', { extensions: ['txt'] })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(200, done)
//             })
//         });

//         describe('when trying to get a file without extension with matching doted .extensions sufficed', function () {
//             it('should 200', function (done) {
//                 const app = new Koa()

//                 app.use(async (ctx) => {
//                     await send(ctx, 'test/fixtures/hello', { extensions: ['.txt'] })
//                 })

//                 request(app.listen())
//                     .get('/')
//                     .expect(200, done)
//             })
//         });
//     });

//     it('should set the Content-Type', function (done) {
//         const app = new Koa();

//         app.use(async (ctx) => {
//             await send(ctx, '/test/fixtures/user.json')
//         });

//         request(app.listen())
//             .get('/')
//             .expect('Content-Type', /application\/json/)
//             .end(done);
//     });

//     it('should set the Content-Length', function (done) {
//         const app = new Koa();

//         app.use(async (ctx) => {
//             await send(ctx, '/test/fixtures/user.json')
//         });

//         request(app.listen())
//             .get('/')
//             .expect('Content-Length', '18')
//             .end(done);
//     });

//     it('should set Last-Modified', function (done) {
//         const app = new Koa();

//         app.use(async (ctx) => {
//             await send(ctx, '/test/fixtures/user.json')
//         });

//         request(app.listen())
//             .get('/')
//             .expect('Last-Modified', /GMT/)
//             .end(done);
//     });

//     describe('with setHeaders', function () {
//         it('throws if setHeaders is not a function', function (done) {
//             const app = new Koa()

//             app.use(async (ctx) => {
//                 await send(ctx, '/test/fixtures/user.json', {
//                     setHeaders: 'foo'
//                 })
//             })

//             request(app.listen())
//                 .get('/')
//                 .expect(500)
//                 .end(done)
//         });

//         it('should not edit already set headers', function (done) {
//             const app = new Koa()

//             const testFilePath = '/test/fixtures/user.json'
//             const normalizedTestFilePath = path.normalize(testFilePath)

//             app.use(async (ctx) => {
//                 await send(ctx, testFilePath, {
//                     setHeaders(res, path, stats) {
//                         assert.equal(path.substr(-normalizedTestFilePath.length), normalizedTestFilePath)
//                         assert.equal(stats.size, 18)
//                         assert(res)

//                         // these can be set
//                         res.setHeader('Cache-Control', 'max-age=0,must-revalidate')
//                         res.setHeader('Last-Modified', 'foo')
//                         // this one can not
//                         res.setHeader('Content-Length', 9000)
//                     }
//                 })
//             })

//             request(app.listen())
//                 .get('/')
//                 .expect(200)
//                 .expect('Cache-Control', 'max-age=0,must-revalidate')
//                 .expect('Last-Modified', 'foo')
//                 .expect('Content-Length', '18')
//                 .end(done)
//         });

//         it('should correctly pass through regarding usual headers', function (done) {
//             const app = new Koa()

//             app.use(async (ctx) => {
//                 await send(ctx, '/test/fixtures/user.json', {
//                     setHeaders: () => { }
//                 })
//             })

//             request(app.listen())
//                 .get('/')
//                 .expect(200)
//                 .expect('Cache-Control', 'max-age=0')
//                 .expect('Content-Length', '18')
//                 .expect('Last-Modified', /GMT/)
//                 .end(done)
//         });
//     });

//     it('should cleanup on socket error', function (done) {
//         const app = new Koa();
//         let stream;

//         app.use(async (ctx) => {
//             await send(ctx, '/test/fixtures/user.json');
//             stream = ctx.body;
//             ctx.socket.emit('error', new Error('boom'));
//         });

//         request(app.listen())
//             .get('/')
//             .expect(500, function (err) {
//                 assert.ok(err);
//                 assert.ok(stream.destroyed);
//                 done();
//             });
//     });
// });
