const dateTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Ljubljana",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/**
 * Slovenian date and time in Ljubljana time, e.g. "3. 11. 2026, 21:29". Built by hand from the date's
 * parts because Node and browsers ship different locale data: the "sl-SI" format printed "2026" on
 * the server and "26" in the browser, and React rejects a page that renders differently in the two.
 */
export function formatDateTime(iso: string): string {
  const parts = dateTimeParts.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const twoDigits = (value: number) => String(value).padStart(2, "0");

  return `${part("day")}. ${part("month")}. ${part("year")}, ${twoDigits(part("hour"))}:${twoDigits(part("minute"))}`;
}

export function formatConfidence(value: number | null): string | null {
  return value === null ? null : `${Math.round(value * 100)} %`;
}
