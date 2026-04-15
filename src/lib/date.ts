const DE_LOCALE = "de-DE";

export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(DE_LOCALE, { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(DE_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(DE_LOCALE, { month: "long", year: "numeric" });
}

export function digestSlug(dateStr: string, slot: string): string {
  return `${dateStr}-${slot}`;
}

export function parseDigestSlug(slug: string): { date: string; slot: string } | null {
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})-(morgen|mittag|abend)$/);
  if (!match) return null;
  return { date: match[1], slot: match[2] };
}

export function isOlderThanDays(date: Date | string, days: number): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d < cutoff;
}
