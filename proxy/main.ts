/**
 * Deno Deploy entry point for the IGDB proxy. See proxy/README.md.
 *
 * Local run:
 *   IGDB_CLIENT_ID=… IGDB_CLIENT_SECRET=… GITHUB_OWNER=… GITHUB_REPO=… \
 *     deno run --allow-net --allow-env proxy/main.ts
 */

import { createHandler, configFromEnv } from './handler.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): unknown
}

Deno.serve(createHandler(configFromEnv(name => Deno.env.get(name))))
