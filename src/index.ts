import { Context } from 'koa';
import { send, StaticServerOptions } from './send';

export function serve(root: string = '.', opts?: StaticServerOptions) {

    if (opts && opts.defer) {
        return async (ctx: Context, next: () => Promise<any>) => {
            await next();

            if (ctx.method !== 'HEAD' && ctx.method !== 'GET') {
                return;
            }

            // response is already handled
            if ((ctx.body !== null && ctx.body !== undefined) || ctx.status !== 404) {
                return;
            }
            try {
                await send(ctx, root, opts);
            } catch (err) {
                if (err.status !== 404) {
                    throw err;
                }
            }
        };
    }

    return async (ctx: Context, next: () => Promise<any>) => {
        let done: string | false = false;

        if (ctx.method === 'HEAD' || ctx.method === 'GET') {
            try {
                done = await send(ctx, root, opts);
            } catch (err) {
                if (err.status !== 404) {
                    throw err;
                }
            }
        }

        if (!done) {
            await next();
        }
    };

}
