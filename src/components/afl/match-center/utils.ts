
export const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

export function formatDateShort(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.toLocaleDateString(undefined, { day: "2-digit" });
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${day} ${month}`;
}

export function formatDateLong(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "long" });
}

export function safeParseTime(t: string) {
  // "19:40" -> minutes since midnight for sorting
  const m = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(t.trim());
  if (!m) return 0;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return hh * 60 + mm;
}
