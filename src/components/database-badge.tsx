import { connection } from "next/server";
import { databaseLabel } from "@/lib/database-label";

/** Development only: says which database the app is using right now, so nobody has to guess. */
export async function DatabaseBadge() {
  if (process.env.NODE_ENV !== "development") return null;
  await connection();

  const label = databaseLabel(process.env.DATABASE_URL);
  return label ? (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
      Baza: {label}
    </span>
  ) : (
    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
      Baza ni nastavljena
    </span>
  );
}
