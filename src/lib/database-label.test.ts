import { describe, expect, it } from "vitest";
import { databaseLabel } from "./database-label";

describe("databaseLabel", () => {
  it("names the databases this project uses", () => {
    expect(databaseLabel("postgresql://postgres.ref:secret@region.pooler.supabase.com:6543/postgres")).toBe("Supabase");
    expect(databaseLabel("postgres://inbox:secret@localhost:5432/inbox")).toBe("lokalna (Docker)");
  });

  it("shows only the host of any other database, never the password", () => {
    const label = databaseLabel("postgres://user:secret@db.example.com:5432/app");
    expect(label).toBe("db.example.com");
    expect(label).not.toContain("secret");
  });

  it("returns nothing when there is no usable address", () => {
    expect(databaseLabel(undefined)).toBeNull();
    expect(databaseLabel("")).toBeNull();
    expect(databaseLabel("not a url")).toBeNull();
  });
});
