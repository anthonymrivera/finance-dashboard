import "server-only";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "@/lib/env";
import * as schema from "./schema";

// The Neon serverless driver talks WebSockets. In the browser that's built in;
// under Node it needs an explicit implementation.
neonConfig.webSocketConstructor = ws;

/**
 * Reuse the pool across hot reloads. Without this, every edit in dev opens a
 * fresh pool and Neon starts refusing connections after a few dozen saves.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? new Pool({ connectionString: env.DATABASE_URL });

if (env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
