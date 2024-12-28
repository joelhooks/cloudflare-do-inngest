import { Hono } from "hono";
import { createMiddleware } from 'hono/factory'
import { InngestHandler } from './inngest/inngest-handler-do'

type Bindings = {
  INNGEST_HANDLER: DurableObjectNamespace<InngestHandler>
}

type Variables = {
  inngestStub: DurableObjectStub<InngestHandler>
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const inngestMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const id = c.env.INNGEST_HANDLER.idFromName("inngest")
  const stub = c.env.INNGEST_HANDLER.get(id)
  c.set('inngestStub', stub)
  await next()
})

app.on(["GET", "PUT", "POST"], "/api/inngest", inngestMiddleware, async (c) => {
  return c.var.inngestStub.fetch(c.req.raw)
})

export { InngestHandler }

export default app;