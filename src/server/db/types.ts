import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Driver-agnostic database type: production uses postgres-js, tests use PGlite
 * (in-process Postgres), both expose the same Drizzle query builder.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
