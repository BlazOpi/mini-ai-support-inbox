/**
 * Rewrites supabase/setup.sql from the migrations and the demo data.
 * Usage: npm run db:supabase-sql   (after `npm run db:generate` or a change to supabase/seed.sql)
 */
import { writeFileSync } from "node:fs";
import { buildSupabaseSetupSql } from "./supabase-setup-sql";

writeFileSync("supabase/setup.sql", buildSupabaseSetupSql());
console.log("✓ supabase/setup.sql rebuilt");
