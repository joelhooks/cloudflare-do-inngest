# Cloudflare DO + Inngest Example 🚀

A proof-of-concept implementation showing how to run Inngest with Cloudflare Durable Objects. This is an example repo demonstrating the pattern, not a published package.

## What the Freak Is This?

This is an example implementation showing how to run Inngest functions in Cloudflare Workers using Durable Objects. It demonstrates patterns for:

- Background job processing in Cloudflare
- Event-driven architectures
- Reliable async processing that doesn't shit the bed

## Usage

Clone this repo to check it out:

```bash
git clone https://github.com/joelhooks/cloudflare-do-inngest.git
cd cloudflare-do-inngest
pnpm install
```

### 1. Set Up Your Durable Object

```ts
import { createInngestDO } from '@joelhooks/cloudflare-do-inngest'
import { inngest } from './inngest-client'
import { functions } from './functions'

export class InngestHandler extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    return createInngestDO({
      client: inngest,
      functions,
    })(state, env)
  }
}
```

### 2. Configure Your Worker

```ts
import { Hono } from "hono"
import { createMiddleware } from 'hono/factory'
import { InngestHandler } from './inngest-handler'

type Bindings = {
  INNGEST_HANDLER: DurableObjectNamespace<InngestHandler>
}

const app = new Hono<{ Bindings: Bindings }>()

const inngestMiddleware = createMiddleware(async (c, next) => {
  const id = c.env.INNGEST_HANDLER.idFromName("inngest")
  const stub = c.env.INNGEST_HANDLER.get(id)
  c.set('inngestStub', stub)
  await next()
})

app.on(["GET", "PUT", "POST"], "/api/inngest", inngestMiddleware, async (c) => {
  return c.var.inngestStub.fetch(c.req.raw)
})

export default app
```

### 3. Define Your Functions

```ts
import { inngest } from "./inngest-client"

export const processOrder = inngest.createFunction(
  { id: "process-order" },
  { event: "order/created" },
  async ({ event, step }) => {
    // Do your work here
    return {
      status: "processed",
      orderId: event.data.orderId
    }
  }
)
```

## Configuration

Make sure you've got these in your `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "INNGEST_HANDLER"
class_name = "InngestHandler"

[[migrations]]
tag = "v1"
new_classes = ["InngestHandler"]
```

## TypeScript Support

This is written in TypeScript and includes all the type definitions you need. Define your event types like this:

```ts
import { EventSchemas } from "inngest"

type OrderEvent = {
  name: "order/created"
  data: {
    orderId: string
    amount: number
  }
}

export type InngestEvents = OrderEvent

export const schemas = new EventSchemas().fromUnion<InngestEvents>()
```

## Contributing

1. Fork it
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## License

MIT - Do whatever you want with it.
