import { cacheStore } from "./store";

type Loader<T> = () => Promise<T>;

export class JsonCache {
  private readonly inflight = new Map<string, Promise<unknown>>();

  async getOrLoad<T>(key: string, ttlSeconds: number, loader: Loader<T>): Promise<T> {
    try {
      const cached = await cacheStore.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      console.warn(`Cache read failed for ${key}:`, error);
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const pending = (async () => {
      const value = await loader();
      try {
        await cacheStore.set(key, JSON.stringify(value), ttlSeconds);
      } catch (error) {
        console.warn(`Cache write failed for ${key}:`, error);
      }
      return value;
    })();

    this.inflight.set(key, pending);

    try {
      return await pending;
    } finally {
      this.inflight.delete(key);
    }
  }

  async invalidate(keys: string[]): Promise<void> {
    try {
      await cacheStore.del(keys);
    } catch (error) {
      console.warn(`Cache invalidation failed for ${keys.join(", ")}:`, error);
    }
  }
}

export const jsonCache = new JsonCache();
