import test from 'ava';
import * as Koa from 'koa';
import * as path from 'path';
import * as request from 'supertest';
import { send } from '../src/send';

const decompressSync = require('iltorb').decompressSync;

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
    t.deepEqual(res.text, 'html index', 'when the index file is present should serve it, default to index.html');

});

test('with .index path', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test/fixtures/world');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/');
    t.is(res.status, 200, 'when the index file is present should 200');
    t.deepEqual(res.text, 'html index', 'when the index file is present should serve it, default to index.html');
});

test('with .index index.txt', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test/fixtures', {index: 'index.txt'});
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/');
    t.is(res.status, 200, 'when the index file is present should 200');
    t.deepEqual(res.text, 'text index', 'when the index file is present should serve it');
});

test('with .index false', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test/fixtures', {index: false});
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/');
    t.is(res.status, 404, 'when the index file option is set to false');
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

test('when path is a file or .gz version when requested and if possible', async (t) => {
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
    t.deepEqual(res.header['content-length'], '18',
        'should return the original version when accept-encoding has no gzip or br');
    t.deepEqual(res.text, '{ "name": "tobi" }',
        'should return the original version when accept-encoding has no gzip or br');
    t.is(res.status, 200, 'should 200');
});

test('when path is a file or .gz version when requested and if possible', async (t) => {
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

test('when path is a file or .gz version when requested and if possible', async (t) => {
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

test('when path is a file or .br version when requested and if possible', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test');
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path + '.br'), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/gzip.json')
        .set('Accept-Encoding', 'br, gzip, deflate, identity');
    t.deepEqual(res.header['content-length'], '22', 'should return .br path (brotli option defaults to true)');
    t.is(res.status, 200, 'should return .br path (brotli option defaults to true)');
    t.deepEqual(decompressSync(res.body).toString(), '{ "name": "tobi" }',
        'should return .br path (brotli option defaults to true)');
});

test('when path is a file or .br version when requested and if possible', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test', { brotli: false });
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/gzip.json')
        .set('Accept-Encoding', 'br, deflate, identity');
    t.deepEqual(res.header['content-length'], '18', 'should not return .br path when brotli option is false');
    t.deepEqual(res.text, '{ "name": "tobi" }', 'should not return .br path when brotli option is false');
    t.is(res.status, 200, 'should not return .br path when brotli option is false');
});

test('when path is a file or .br version when requested and if possible', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test', { brotli: false });
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path + '.gz'), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/gzip.json')
        .set('Accept-Encoding', 'br, gzip, deflate, identity');
    t.deepEqual(res.header['content-length'], '48', 'should return .gz path when brotli option is turned off');
    t.deepEqual(res.text, '{ "name": "tobi" }', 'should return .gz path when brotli option is turned off');
    t.is(res.status, 200, 'should return .gz path when brotli option is turned off');
});

test('when path is a file and max-age is set', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test', { maxAge: 5000 });
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should set max-age in seconds');
    t.deepEqual(res.header['cache-control'], 'max-age=5', 'should set max-age in seconds');
});

test('when path is a file  and max-age is set', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test', { maxAge: 1234 });
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should truncate fractional values for max-age');
    t.deepEqual(res.header['cache-control'], 'max-age=1', 'should truncate fractional values for max-age');
});

test('when path is a file and immutable is specified', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test', { maxAge: 31536000000, immutable: true });
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should set the immutable directive');
    t.deepEqual(res.header['cache-control'], 'max-age=31536000,immutable',
        'should set the immutable directive');
});

test('.immutable option when trying to get a non-existent file', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        const returnPath = await send(ctx, 'test', { immutable: true });
        t.deepEqual(returnPath, path.join(process.cwd(), 'test', ctx.path), 'should return the path');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/does-not-exist.json');
    t.is(res.status, 404, 'should set the immutable directive');
    t.is(res.header['cache-control'], undefined,
        'should not set the Cache-Control header');
});

test('.hidden option when trying to get a hidden file', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/.hidden');
    t.is(res.status, 404, 'should 404');
});

test('.hidden option when trying to get a file from a hidden directory', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/.private/id_rsa.txt');
    t.is(res.status, 404, 'should 404');
});

test('.hidden option when trying to get a hidden file and .hidden check is turned off', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { hidden: true });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/.hidden');
    t.is(res.status, 200, 'should 200');
});

test('.extensions option when trying to get a file without extension with no .extensions sufficed', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/hello');
    t.is(res.status, 404, 'should 404');
});

test('.extensions option when trying to get a file without extension with no matching .extensions', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { extensions: ['json', 'htm', 'html'] });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/hello');
    t.is(res.status, 404, 'should 404');
});

test('.extensions option when trying to get a file without extension with\
matching .extensions sufficed first matched should be sent', async (t) => {
        const { app } = t.context as TestContext;
        app.use(async (ctx) => {
            await send(ctx, 'test', { extensions: ['json', 'txt', 'html'] });
        });
        const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
        const res = await req.get('/fixtures/user');
        t.is(res.status, 200, 'should 200');
        t.deepEqual(res.header['content-type'], 'application/json; charset=utf-8', 'should 200 and application/json');
    });

test('.extensions option when trying to get a file without extension with matching .extensions sufficed', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test', { extensions: ['txt'] });
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/hello');
    t.is(res.status, 200, 'should 200');
});

test('.extensions option when trying to get a file without extension with\
matching doted .extensions sufficed', async (t) => {
        const { app } = t.context as TestContext;
        app.use(async (ctx) => {
            await send(ctx, 'test', { extensions: ['.txt'] });
        });
        const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
        const res = await req.get('/fixtures/hello');
        t.is(res.status, 200, 'should 200');
    });

test('it should set the content-type', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should 200');
    t.deepEqual(res.header['content-type'], 'application/json; charset=utf-8', 'should 200 and set content-type');
});

test('it should set the content-length', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should 200');
    t.deepEqual(res.header['content-length'], '18', 'should 200 and set content-length');
});

test('it should set Last-Modified', async (t) => {
    const { app } = t.context as TestContext;
    app.use(async (ctx) => {
        await send(ctx, 'test');
    });
    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should 200');
    t.truthy(res.header['last-modified'].indexOf('GMT'), 'should set last-modified');
});

test('with setHeaders should not edit already set headers', async (t) => {
    const { app } = t.context as TestContext;
    const testFilePath = '/fixtures/user.json';
    const normalizedTestFilePath = path.normalize(testFilePath);

    app.use(async (ctx) => {
        await send(ctx, 'test', {
            setHeaders(res_, path_, stats) {
                t.deepEqual(path_.substr(-normalizedTestFilePath.length), normalizedTestFilePath, 'path in setHeaders');
                t.is(stats.size, 18, 'stats in setHeaders');
                t.truthy(res_, 'res in setHeaders');

                // these can be set
                res_.setHeader('Cache-Control', 'max-age=0,must-revalidate');
                res_.setHeader('Last-Modified', 'foo');
                // this one can not
                res_.setHeader('Content-Length', '9000');
            },
        });
    });

    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    const res = await req.get('/fixtures/user.json');
    t.is(res.status, 200, 'should 200');
    t.deepEqual(res.header['cache-control'], 'max-age=0,must-revalidate',
        'should set cache-control');
    t.deepEqual(res.header['last-modified'], 'foo', 'should set last-modified');
    t.deepEqual(res.header['content-length'], '18', 'should set content-length');
});

test('should cleanup on socket error', async (t) => {
    const { app } = t.context as TestContext;
    let stream: any;
    app.use(async (ctx) => {
        await send(ctx, 'test');
        stream = ctx.body;
        ctx.socket.emit('error', new Error('boom'));
    });

    const req = request(app.listen(10000 + Math.ceil(Math.random() * 20000)));
    await t.throws(req.get('/fixtures/user.json'), 'socket hang up', 'should throw error');
    t.truthy(stream.destroyed, 'should destroyed the stream');
    // TODO, should return 500
    // t.is(res.status, 500, 'should 500');
});
