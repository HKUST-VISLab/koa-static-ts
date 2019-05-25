import test from 'ava';
import * as Koa from 'koa';
import * as request from 'supertest';
import serve from '../src';

test('serve default root path as process.cwd()', async (t) => {
    const app = new Koa();
    app.use(serve());
    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/package.json');
    t.is(res.status, 200, 'when root is not provided, should serve from cwd');
});

test('serve(root) when defer: false', async (t) => {
    const app = new Koa();
    app.use(serve('.'));
    app.use(async (ctx) => {
        ctx.body = 'ok';
    });
    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    let res = await req.get('/package.json');
    t.is(res.status, 200, 'when root = ".", should serve from cwd');

    res = await req.get('/something');
    t.is(res.status, 200, 'should not return 404');
    t.deepEqual(res.text, 'ok', 'should pass to next');
    await t.notThrowsAsync(req.get('/something'), 'should not throw 404 error');

});

// test('serve(root) when defer: false', async (t) => {
//     const app = new Koa();

//     app.use(serve('test/fixtures'));
//     app.use(async (ctx) => {
//         ctx.body = 'ok';
//     });
//     const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
//     const res = await req.get('/something');
//     t.is(res.status, 200, 'should not return 404');
//     t.deepEqual(res.text, 'ok', 'should pass to next');
//     await t.notThrowsAsync(req.get('/something'), 'should not throw 404 error');
// });

test('serve(root) when defer: false, when upstream middleware responds', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures'));
    app.use(async (ctx, next) => {
        ctx.body = 'hey';
    });
    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/hello.txt');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'world', 'should respond');
});

test('serve(root) when defer: false, when disable index', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { index: false }));
    app.use(async (ctx, next) => {
        ctx.body = 'oh no';
    });
    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'oh no', 'should pass to downstream if 404');
});

test('serve(root) when defer: false, when method is not `GET` or `HEAD`', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures'));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.post('/hello.txt');
    t.is(res.status, 404, 'should return 404');
    await t.notThrowsAsync(req.post('/hello.txt'), 'it should not throw 404 errors');
});

test('serve(root) when defer: true', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true }));
    app.use(async (ctx, next) => {
        await next();
        ctx.body = 'hey';
    });

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/hello.txt');
    t.is(res.status, 200, 'when upstream middleware responds, should return 200');
    t.deepEqual(res.text, 'hey', 'when upstream middleware responds, should do nothing');
});

test('serve(root), when defer:true and the path is valid', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true }));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/hello.txt');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'world', 'should return the file');
});

test('serve(root), when defer:true and .index present', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true, index: 'index.txt' }));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.header['content-type'], 'text/plain; charset=utf-8');
    t.deepEqual(res.text, 'text index', 'should return the index file');
});

test('serve(root), when defer:true and .index omitted', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true }));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/world/');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.header['content-type'], 'text/html; charset=utf-8');
    t.deepEqual(res.text, 'html index', 'should return the file');
});

test('serve(root), when defer:true and when path is not a file', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true }));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.get('/something');
    t.is(res.status, 404, 'should return 404');
    await t.notThrowsAsync(req.get('/something'), 'it should not throw 404 errors');
});

test('serve(root) when defer: true, when method is not `GET` or `HEAD`', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true }));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    const res = await req.post('/hello.txt');
    t.is(res.status, 404, 'should return 404');
    await t.notThrowsAsync(req.post('/hello.txt'), 'it should not throw 404 errors');
});

test('serve(root), when defer:true and it should not handle the request', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true }));
    app.use((ctx) => {
        if (ctx.path.includes('something')) {
            ctx.status = 204;
        } else if (ctx.path.includes('somethigng')) {
            ctx.status = 200;
            ctx.body = '';
        }
    });

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    let res = await req.get('/something%%%/');
    t.is(res.status, 204, 'should not handle if the status is not 404');

    res = await req.get('/somethigng%%%/');
    t.is(res.status, 200, 'should not handle if the body is not null or undefined');
    t.deepEqual(res.text, '', 'should return the body from up stream');
});

// test('serve(root), when defer:true and it should not handle the request', async (t) => {
//     const app = new Koa();
//     app.use(serve('test/fixtures', { defer: true }));
//     app.use((ctx) => {
//         ctx.body = '';
//     });

//     const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
//     const res = await req.get('/something%%%/');
//     t.is(res.status, 200, 'should not handle if the body is not null or undefined');
//     t.deepEqual(res.text, '', 'should return the body from up stream');
// });

test('serve(root), when format:false', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true, format: false }));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    let res = await req.get('/world');
    t.is(res.status, 404, 'should return 404, cannot get the directory without slash');

    res = await req.get('/world/');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'html index', 'should get the directory with slash');
});

// test('serve(root), when format:false', async (t) => {
//     const app = new Koa();
//     app.use(serve('test/fixtures', { defer: true, format: false }));

//     const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
//     const res = await req.get('/world/');
//     t.is(res.status, 200, 'should return 200');
//     t.deepEqual(res.text, 'html index', 'should get the directory with slash');
// });

test('serve(root), when format:true', async (t) => {
    const app = new Koa();
    app.use(serve('test/fixtures', { defer: true, format: true }));

    const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
    let res = await req.get('/world');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'html index', 'should get the directory without slash');

    res = await req.get('/world/');
    t.is(res.status, 200, 'should return 200');
    t.deepEqual(res.text, 'html index', 'should get the directory with slash');
});

// test('serve(root), when format:true', async (t) => {
//     const app = new Koa();
//     app.use(serve('test/fixtures', { defer: true, format: true }));

//     const req = request(app.listen(20000 + Math.ceil(Math.random() * 30000)));
//     const res = await req.get('/world/');
//     t.is(res.status, 200, 'should return 200');
//     t.deepEqual(res.text, 'html index', 'should get the directory with slash');
// });
