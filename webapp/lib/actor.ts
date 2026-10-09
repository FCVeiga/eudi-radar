import type { CurrentUser } from '@/lib/auth';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Who an MCP request runs as. A workspace id makes plan checks use that workspace. */
export type Actor = { user: CurrentUser; workspaceId: string | null };

const actors = new AsyncLocalStorage<Actor>();

export function getActor(): Actor | null {
  return actors.getStore() ?? null;
}

export function runAs<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  return actors.run(actor, fn);
}
