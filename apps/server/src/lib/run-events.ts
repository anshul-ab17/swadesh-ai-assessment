import { EventEmitter } from "events";

const emitters = new Map<string, EventEmitter>();

export function getRunEmitter(runId: string): EventEmitter {
  if (!emitters.has(runId)) {
    const ee = new EventEmitter();
    ee.setMaxListeners(20);
    emitters.set(runId, ee);
  }
  return emitters.get(runId)!;
}

export function cleanupRunEmitter(runId: string): void {
  emitters.delete(runId);
}
