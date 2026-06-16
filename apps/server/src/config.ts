import type { TableDefaults } from "@friendly-holdem/shared";

export type ServerConfig = {
  port: number;
  clientOrigin: string;
  clientCorsOrigins: string[];
  defaults: TableDefaults;
};

export type RawEnvironment = Partial<Record<string, string | undefined>>;

const DEFAULTS = {
  PORT: "8787",
  CLIENT_ORIGIN: "http://localhost:5173",
  DEFAULT_STARTING_STACK: "1000",
  DEFAULT_SMALL_BLIND: "5",
  DEFAULT_BIG_BLIND: "10",
  DISCONNECTED_ACTION_GRACE_MS: "30000",
  HOST_AUTO_FOLD_AFTER_MS: "120000",
  EVENT_LOG_CAP: "200"
} as const;

export function loadConfig(env: RawEnvironment = process.env): ServerConfig {
  const port = readInteger(env, "PORT", DEFAULTS.PORT, { min: 1, max: 65535 });
  const clientOrigin = readOrigin(env.CLIENT_ORIGIN ?? DEFAULTS.CLIENT_ORIGIN);
  const startingStack = readInteger(env, "DEFAULT_STARTING_STACK", DEFAULTS.DEFAULT_STARTING_STACK, {
    min: 1
  });
  const smallBlind = readInteger(env, "DEFAULT_SMALL_BLIND", DEFAULTS.DEFAULT_SMALL_BLIND, {
    min: 1
  });
  const bigBlind = readInteger(env, "DEFAULT_BIG_BLIND", DEFAULTS.DEFAULT_BIG_BLIND, {
    min: smallBlind + 1
  });
  const disconnectedActionGraceMs = readInteger(
    env,
    "DISCONNECTED_ACTION_GRACE_MS",
    DEFAULTS.DISCONNECTED_ACTION_GRACE_MS,
    { min: 1000 }
  );
  const hostAutoFoldAfterMs = readInteger(
    env,
    "HOST_AUTO_FOLD_AFTER_MS",
    DEFAULTS.HOST_AUTO_FOLD_AFTER_MS,
    { min: disconnectedActionGraceMs }
  );
  const eventLogCap = readInteger(env, "EVENT_LOG_CAP", DEFAULTS.EVENT_LOG_CAP, {
    min: 1,
    max: 10000
  });

  return {
    port,
    clientOrigin,
    clientCorsOrigins: clientCorsOriginsFor(clientOrigin),
    defaults: {
      startingStack,
      blinds: {
        smallBlind,
        bigBlind
      },
      disconnectedActionGraceMs,
      hostAutoFoldAfterMs,
      eventLogCap
    }
  };
}

function clientCorsOriginsFor(clientOrigin: string): string[] {
  const origins = [clientOrigin];
  const url = new URL(clientOrigin);

  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
    origins.push(url.origin);
  } else if (url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
    origins.push(url.origin);
  }

  return [...new Set(origins)];
}

function readInteger(
  env: RawEnvironment,
  key: keyof typeof DEFAULTS,
  fallback: string,
  options: { min?: number; max?: number } = {}
): number {
  const rawValue = env[key] ?? fallback;
  const value = Number(rawValue);

  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer.`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`${key} must be at least ${options.min}.`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`${key} must be at most ${options.max}.`);
  }

  return value;
}

function readOrigin(value: string): string {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }

    return url.origin;
  } catch {
    throw new Error("CLIENT_ORIGIN must be a valid http or https origin.");
  }
}
