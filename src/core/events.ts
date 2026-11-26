/**
 * Minimal typed event bus. The simulation emits facts ("tile dug", "item
 * spawned", "dwarf hit rock"); renderers, audio and UI subscribe. The sim
 * never imports render/audio code.
 */
export type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(type: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  /**
   * Delivers to every subscriber present when the event was emitted: one that
   * subscribes during delivery waits for the next event, and one that throws
   * does not starve the others (errors are rethrown after delivery).
   */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) return;
    const fns = [...set] as Handler<Events[K]>[];
    let errors: unknown[] | null = null;
    for (const fn of fns) {
      try {
        fn(payload);
      } catch (e) {
        (errors ??= []).push(e);
      }
    }
    if (errors) throw errors.length === 1 ? errors[0] : new AggregateError(errors, `${String(type)}: ${errors.length} subscribers failed`);
  }

  clear(): void {
    this.handlers.clear();
  }
}
