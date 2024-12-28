import { DurableObject } from 'cloudflare:workers'
import { InngestCommHandler, ServeHandlerOptions } from "inngest"
import { Either } from "inngest/helpers/types"
import { SupportedFrameworkName } from "inngest/types"

export const frameworkName: SupportedFrameworkName = "cloudflare-pages";

export type PagesHandlerArgs = [
  { request: Request; env: Record<string, string | undefined> },
];

export type WorkersHandlerArgs = [Request, Record<string, string | undefined>];

const deriveHandlerArgs = (
  args: Either<PagesHandlerArgs, WorkersHandlerArgs>
): { req: Request; env: Record<string, string | undefined> } => {
  if (!Array.isArray(args) || args.length < 1) {
    throw new Error("No arguments passed to serve handler");
  }

  if (typeof args[0] === "object" && "request" in args[0] && "env" in args[0]) {
    return {
      req: args[0].request,
      env: args[0].env,
    };
  }

  if (args.length > 1 && typeof args[1] === "object") {
    return {
      req: args[0],
      env: args[1],
    };
  }

  throw new Error(
    "Could not derive handler arguments from input; are you sure you're using serve() correctly?"
  );
};

export class InngestDurableObject extends DurableObject {
  private handler: InngestCommHandler;

  constructor(state: DurableObjectState, env: Record<string, any>, options: ServeHandlerOptions) {
    super(state, env);
    this.handler = new InngestCommHandler({
      frameworkName,
      fetch: fetch.bind(globalThis),
      ...options,
      handler: (...args: Either<PagesHandlerArgs, WorkersHandlerArgs>) => {
        const { req, env } = deriveHandlerArgs(args);

        return {
          body: () => req.json(),
          headers: (key) => req.headers.get(key),
          method: () => req.method,
          env: () => env,
          url: () => new URL(req.url, `https://${req.headers.get("host") || ""}`),
          transformResponse: ({ body, status, headers }) => {
            return new Response(body, {
              status,
              headers,
            });
          },
          transformStreamingResponse: ({ body, status, headers }) => {
            return new Response(body, {
              status,
              headers,
            });
          },
        };
      },
    });
  }

  async fetch(request: Request) {
    return this.handler.createHandler()({ request, env: this.env });
  }
}

/**
 * Creates a factory function that instantiates an InngestDurableObject with the provided options.
 * 
 * @example
 * ```ts
 * export class MyInngestHandler extends DurableObject {
 *   constructor(state: DurableObjectState, env: Env) {
 *     super(state, env);
 *     return createInngestDO({
 *       client: inngest,
 *       functions: [myFunction],
 *     })(state, env);
 *   }
 * }
 * ```
 */
export const createInngestDO = (options: ServeHandlerOptions) => {
  return (state: DurableObjectState, env: Record<string, any>) => {
    return new InngestDurableObject(state, env, options);
  };
}; 