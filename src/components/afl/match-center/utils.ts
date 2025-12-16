/* -------------------------------------------------------------------------- */
/* UTILS                                                                      */
/* -------------------------------------------------------------------------- */

export function formatDateShort(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatDateLong(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function safeParseTime(time: string) {
  // "19:40" → minutes since midnight (for sorting)
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}
