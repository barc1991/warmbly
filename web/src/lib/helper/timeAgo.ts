// timeAgo renders a compact relative time in Hebrew ("לפני 3 דקות", "אתמול"),
// falling back to a localized date once the distance passes a month.
export default function timeAgo(d?: string | Date): string {
    if (!d) return "אף פעם";
    const ms = Date.now() - new Date(d).getTime();
    const min = Math.floor(ms / 60_000);
    if (min < 1) return "הרגע";
    if (min === 1) return "לפני דקה";
    if (min < 60) return `לפני ${min} דקות`;
    const h = Math.floor(min / 60);
    if (h === 1) return "לפני שעה";
    if (h === 2) return "לפני שעתיים";
    if (h < 24) return `לפני ${h} שעות`;
    const days = Math.floor(h / 24);
    if (days === 1) return "אתמול";
    if (days === 2) return "שלשום";
    if (days < 30) return `לפני ${days} ימים`;
    return new Date(d).toLocaleDateString("he-IL");
}
