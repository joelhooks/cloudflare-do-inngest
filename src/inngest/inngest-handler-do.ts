import { DurableObject } from 'cloudflare:workers'
import { inngest } from './inngest-client'
import { createInngestDO } from './cloudflare-do'
import { functions } from './index'

export class InngestHandler extends DurableObject {
  constructor(state: DurableObjectState, env: Record<string, any>) {
    super(state, env)
    // Return a new instance of InngestDurableObject with our config
    return createInngestDO({
      client: inngest,
      functions,
    })(state, env)
  }
} 