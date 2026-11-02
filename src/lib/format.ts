// Explicit time zone keeps server-rendered and client-rendered output identical (no hydration mismatch).
const dateTimeFormat = new Intl.DateTimeFormat("sl-SI", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Ljubljana",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatConfidence(value: number | null): string | null {
  return value === null ? null : `${Math.round(value * 100)} %`;
}
