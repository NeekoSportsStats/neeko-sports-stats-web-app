
export const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

export function formatDateShort(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.toLocaleDateString(undefined, { day: "2-digit" });
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${day} ${month}`;
}
