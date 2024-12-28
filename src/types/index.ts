import { ContentManager } from "../durable-objects/ContentManager"

export interface Env {
  CONTENT_MANAGER: DurableObjectNamespace<typeof ContentManager>
} 