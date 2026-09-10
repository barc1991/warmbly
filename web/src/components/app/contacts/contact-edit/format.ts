// Tiny date helpers used across the contact slide-over tabs.
// Centralized so the format stays consistent — every "last opened
// 5 minutes ago" row, every timeline timestamp, every meta row.

export function fmtAbsolute(d: Date | string | null | undefined): string {
    if (!d) return "—";
    try {
        const dt = typeof d === "string" ? new Date(d) : d;
        return dt.toLocaleString("he-IL", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "—";
    }
}

export function fmtRelative(d: Date | string | null | undefined): string {
    if (!d) return "אף פעם";
    try {
        const dt = typeof d === "string" ? new Date(d) : d;
        const diff = Date.now() - dt.getTime();
        const sec = Math.round(diff / 1000);
        if (sec < 60) return "כרגע";
        const min = Math.round(sec / 60);
        if (min < 60) return `לפני ${min} דק׳`;
        const hr = Math.round(min / 60);
        if (hr < 24) return `לפני ${hr} שע׳`;
        const day = Math.round(hr / 24);
        if (day < 30) return `לפני ${day} ימים`;
        const mo = Math.round(day / 30);
        if (mo < 12) return `לפני ${mo} חודשים`;
        const yr = Math.round(mo / 12);
        return `לפני ${yr} שנים`;
    } catch {
        return "אף פעם";
    }
}
