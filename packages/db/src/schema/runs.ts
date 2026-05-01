import { pgTable, text, timestamp, integer, numeric, uuid } from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  strategy: text("strategy").notNull(),
  model: text("model").notNull(),
  promptHash: text("prompt_hash").notNull(),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalTokensIn: integer("total_tokens_in").default(0),
  totalTokensOut: integer("total_tokens_out").default(0),
  cacheReadTokens: integer("cache_read_tokens").default(0),
  cacheWriteTokens: integer("cache_write_tokens").default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).default("0"),
  wallMs: integer("wall_ms").default(0),
  schemaFailures: integer("schema_failures").default(0),
  hallucinationCount: integer("hallucination_count").default(0),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
