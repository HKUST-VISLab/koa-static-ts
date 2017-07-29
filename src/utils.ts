import { exists as rawExists, stat as rawStat, Stats } from 'fs';
import { Context } from 'koa';
import { isAbsolute, normalize, resolve as pathResolve, sep } from 'path';

export async function exists(path: string | Buffer) {
    return new Promise<boolean>((resolve, reject) => {
        rawExists(path, (result: boolean) => {
            resolve(result);
        });
    });
}

export async function stat(path: string | Buffer) {
    return new Promise<Stats>((resolve, reject) => {
        rawStat(path, (err, stats) => {
            return err ? reject(err) : resolve(stats);
        });
    });
}

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Resolve relative path against a root path
 *
 * @param {string} rootPath
 * @param {string} relativePath
 * @return {string}
 * @public
 */
export function resolvePath(ctx: Context, rootPath: string, relativePath: string) {
    let root = rootPath;

    // containing NULL bytes is malicious
    if (relativePath.indexOf('\0') !== -1) {
        ctx.throw(400, 'Malicious Path');
    }

    // path should never be absolute
    if (isAbsolute(relativePath) || isAbsolute(relativePath)) {
        ctx.throw(400, 'Malicious Path');
    }

    // path outside root
    if (UP_PATH_REGEXP.test(normalize('.' + sep + relativePath))) {
        ctx.throw(403);
    }

    // resolve & normalize the root path
    root = normalize(pathResolve(root) + sep);

    // resolve the path
    return pathResolve(root, relativePath);
}
