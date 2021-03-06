import { createReadStream, Stats } from 'fs';
import { ServerResponse } from 'http';
import { Context } from 'koa';
import { basename, extname, normalize, parse, resolve, sep } from 'path';
import { exists, resolvePath, stat } from './utils';

export interface StaticServerOptions {
    defer?: boolean;
    index?: string | false;
    maxAge?: number;
    immutable?: boolean;
    hidden?: boolean;
    format?: boolean;
    extensions?: string[] | false;
    brotli?: boolean;
    gzip?: boolean;
    setHeaders?: (res: ServerResponse, path: string, stat: Stats) => void;
}

const staticServerDefaultOptions = {
    index: 'index.html' as 'index.html',
    defer: false as false,
    maxAge: 0 as 0,
    immutable: false as false,
    hidden: false as false,
    format: false as false,
    extensions: false as false,
    brotli: true as false,
    gzip: true as true,
};

/**
 * Send file at `path` with the
 * given `options` to the koa `ctx`.
 *
 * @param {Context} ctx
 * @param {String} path
 * @param {Object} [opts]
 * @return {Function}
 * @api public
 */
export async function send(ctx: Context, rootPath: string,
                           opts: StaticServerOptions = {}) {

    const root = normalize(resolve(rootPath));
    const { index,
        maxAge,
        immutable,
        hidden,
        format,
        extensions,
        brotli,
        gzip,
        setHeaders,
    } = Object.assign({}, staticServerDefaultOptions, opts);

    let path: string = ctx.path.substr(parse(ctx.path).root.length);

    // normalize path
    try {
        path = decodeURIComponent(path);
    } catch  (err) {
        ctx.throw(400, 'faild to decoded', err);
    }

    // index file support
    const trailingSlash = ctx.path[ctx.path.length - 1] === '/';
    if (index && trailingSlash) {
        path += index;
    }
    path = resolvePath(ctx, root, path);

    // hidden file support, ignore
    if (!hidden && isHidden(root, path)) {
        return false;
    }

    // serve brotli file when possible otherwise gzipped file when possible
    if (ctx.acceptsEncodings('br', 'deflate', 'identity') === 'br' &&
        brotli &&
        (await exists(path + '.br'))) {
        path = path + '.br';
        ctx.set('Content-Encoding', 'br');
        ctx.res.removeHeader('Content-Length');
    } else if (ctx.acceptsEncodings('gzip', 'deflate', 'identity') === 'gzip' &&
        gzip &&
        (await exists(path + '.gz'))) {

        path = path + '.gz';
        ctx.set('Content-Encoding', 'gzip');
        ctx.res.removeHeader('Content-Length');
    }

    if (extensions && !/\..*$/.exec(path)) {
        for (let ext of extensions) {
            if (!/^\./.exec(ext)) {
                ext = '.' + ext;
            }
            if (await exists(path + ext)) {
                path = path + ext;
                break;
            }
        }
    }

    // stat
    let stats: Stats;
    try {
        stats = await stat(path);

        // Format the path to serve static file servers
        // and not require a trailing slash for directories,
        // so that you can do both `/directory` and `/directory/`
        if (stats.isDirectory()) {
            if (format && index) {
                path += '/' + index;
                stats = await stat(path);
            } else {
                return false;
            }
        }
    } catch (err) {
        const notfound = new Set(['ENOENT', 'ENAMETOOLONG', 'ENOTDIR']);
        if (notfound.has(err.code)) {
            ctx.throw(404, err);
        }
        ctx.throw(500, err);
        return false; // TODO remove when typescript fix the control flow detect of never return type
    }

    if (setHeaders) {
        setHeaders(ctx.res, path, stats);
    }

    // stream
    ctx.set('Content-Length', stats.size.toString());
    if (!ctx.response.get('Last-Modified')) {
        ctx.set('Last-Modified', stats.mtime.toUTCString());
    }
    if (!ctx.response.get('Cache-Control')) {
        const directives = ['max-age=' + Math.floor(maxAge / 1000)];
        if (immutable) {
            directives.push('immutable');
        }
        ctx.set('Cache-Control', directives.join(','));
    }
    ctx.type = type(path);
    ctx.body = createReadStream(path);

    return path;
}

/**
 * Check if it's hidden.
 *
 * @param {string} root
 * @param {string} path
 * @returns
 */
function isHidden(root: string, path: string) {
    const filePath = path.substr(root.length).split(sep);
    for (let i = 0, len = filePath.length; i < len; ++i) {
        if (filePath[i][0] === '.') {
            return true;
        }
    }
    return false;
}

/**
 * File type.
 *
 * @param {string} file
 * @returns
 */
function type(file: string) {
    return extname(basename(file, '.gz'));
}
