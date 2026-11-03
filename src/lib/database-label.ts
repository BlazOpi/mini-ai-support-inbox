/** Names the database in a connection string for people to read. Never includes the password. */
export function databaseLabel(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    if (hostname.endsWith(".supabase.com") || hostname.endsWith(".supabase.co")) return "Supabase";
    if (hostname === "localhost" || hostname === "127.0.0.1") return "lokalna (Docker)";
    return hostname;
  } catch {
    return null;
  }
}
