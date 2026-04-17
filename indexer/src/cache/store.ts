import net from "net";
import tls from "tls";
import { loadIndexerEnv } from "../../lib/env";

loadIndexerEnv();

type RedisResponse = string | number | null;

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(keys: string[]): Promise<void>;
  isReady(): boolean;
}

class InMemoryCacheStore implements CacheStore {
  private readonly values = new Map<string, { value: string; expiresAt: number }>();

  get(key: string): Promise<string | null> {
    const entry = this.values.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    if (Date.now() >= entry.expiresAt) {
      this.values.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    return Promise.resolve();
  }

  del(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.values.delete(key);
    }

    return Promise.resolve();
  }

  isReady(): boolean {
    return true;
  }
}

type PendingResponse = {
  reject: (error: Error) => void;
  resolve: (value: RedisResponse) => void;
};

class RedisCacheStore implements CacheStore {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private readBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private pendingResponses: PendingResponse[] = [];
  private commandQueue: Promise<unknown> = Promise.resolve();
  private connectPromise: Promise<void> | null = null;
  private readonly host: string;
  private readonly username: string;
  private readonly password: string;
  private readonly port: number;
  private readonly database: number;
  private readonly useTls: boolean;
  private ready = false;

  constructor(redisUrl: string) {
    const parsed = new URL(redisUrl);

    this.host = parsed.hostname;
    this.port = Number(parsed.port || 6379);
    this.username = decodeURIComponent(parsed.username || "");
    this.password = decodeURIComponent(parsed.password || "");
    this.database = Number(parsed.pathname.replace("/", "") || "0");
    this.useTls = parsed.protocol === "rediss:";
  }

  isReady(): boolean {
    return this.ready;
  }

  async get(key: string): Promise<string | null> {
    const value = await this.runCommand(["GET", key]);
    return typeof value === "string" ? value : null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.runCommand(["SET", key, value, "EX", String(ttlSeconds)]);
  }

  async del(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.runCommand(["DEL", ...keys]);
  }

  private async runCommand(parts: string[]): Promise<RedisResponse> {
    this.commandQueue = this.commandQueue.then(async () => {
      await this.ensureConnected();
      return this.writeCommand(parts);
    });

    return this.commandQueue as Promise<RedisResponse>;
  }

  private async ensureConnected(): Promise<void> {
    if (this.ready && this.socket) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      const socket = this.useTls
        ? tls.connect({
            host: this.host,
            port: this.port,
            servername: this.host,
          })
        : net.createConnection({
            host: this.host,
            port: this.port,
          });

      socket.once("connect", async () => {
        this.socket = socket;
        this.readBuffer = Buffer.alloc(0);
        this.pendingResponses = [];

        socket.on("data", (chunk) => {
          this.readBuffer = Buffer.concat([this.readBuffer, chunk]);
          this.flushResponses();
        });

        socket.on("error", (error) => {
          this.failPending(error);
          this.reset();
        });

        socket.on("close", () => {
          this.failPending(new Error("Redis connection closed"));
          this.reset();
        });

        try {
          if (this.password) {
            const authParts = this.username
              ? ["AUTH", this.username, this.password]
              : ["AUTH", this.password];
            await this.writeCommand(authParts);
          }

          if (this.database > 0) {
            await this.writeCommand(["SELECT", String(this.database)]);
          }

          this.ready = true;
          resolve();
        } catch (error) {
          socket.destroy();
          reject(error);
        } finally {
          this.connectPromise = null;
        }
      });

      socket.once("error", (error) => {
        socket.destroy();
        this.reset();
        this.connectPromise = null;
        reject(error);
      });
    });

    return this.connectPromise;
  }

  private writeCommand(parts: string[]): Promise<RedisResponse> {
    if (!this.socket) {
      return Promise.reject(new Error("Redis socket not connected"));
    }

    return new Promise<RedisResponse>((resolve, reject) => {
      this.pendingResponses.push({ resolve, reject });
      this.socket!.write(serializeCommand(parts));
    });
  }

  private flushResponses(): void {
    while (this.pendingResponses.length > 0) {
      const parsed = parseRedisResponse(this.readBuffer);
      if (!parsed) {
        return;
      }

      this.readBuffer = parsed.remaining;
      const pending = this.pendingResponses.shift();
      if (!pending) {
        return;
      }

      if (parsed.error) {
        pending.reject(parsed.error);
      } else {
        pending.resolve(parsed.value);
      }
    }
  }

  private failPending(error: Error): void {
    while (this.pendingResponses.length > 0) {
      this.pendingResponses.shift()?.reject(error);
    }
  }

  private reset(): void {
    this.ready = false;
    this.socket = null;
    this.readBuffer = Buffer.alloc(0);
  }
}

const serializeCommand = (parts: string[]): string =>
  `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;

const parseRedisResponse = (
  input: Buffer<ArrayBufferLike>
): { value: RedisResponse; remaining: Buffer<ArrayBufferLike>; error?: Error } | null => {
  if (input.length === 0) return null;

  const prefix = String.fromCharCode(input[0]);
  const lineEnd = input.indexOf("\r\n");
  if (lineEnd === -1) return null;

  if (prefix === "+" || prefix === "-" || prefix === ":") {
    const payload = input.subarray(1, lineEnd).toString("utf8");
    const remaining = input.subarray(lineEnd + 2);

    if (prefix === "-") {
      return { value: null, remaining, error: new Error(payload) };
    }

    if (prefix === ":") {
      return { value: Number(payload), remaining };
    }

    return { value: payload, remaining };
  }

  if (prefix === "$") {
    const length = Number(input.subarray(1, lineEnd).toString("utf8"));
    const bodyStart = lineEnd + 2;

    if (length === -1) {
      return { value: null, remaining: input.subarray(bodyStart) };
    }

    const bodyEnd = bodyStart + length;
    if (input.length < bodyEnd + 2) {
      return null;
    }

    return {
      value: input.subarray(bodyStart, bodyEnd).toString("utf8"),
      remaining: input.subarray(bodyEnd + 2),
    };
  }

  return {
    value: null,
    remaining: Buffer.alloc(0),
    error: new Error(`Unsupported Redis response prefix: ${prefix}`),
  };
};

const createCacheStore = (): CacheStore => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn("Redis URL not configured, using in-memory snapshot cache");
    return new InMemoryCacheStore();
  }

  return new RedisCacheStore(redisUrl);
};

export const cacheStore = createCacheStore();
