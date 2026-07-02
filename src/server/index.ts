import app, { type Env } from './app'

export default {
  async fetch(request: Request, env: Env['Bindings'], ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx)
    }

    // Non-API routes are served by the Workers "assets" binding (SPA build
    // output). Configured in wrangler.toml under [assets].
    return env.ASSETS.fetch(request)
  },
}
