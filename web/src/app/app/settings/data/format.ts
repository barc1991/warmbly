// Shared formatting for the Data settings page.

export function formatBytes(n: number | undefined): string {
    if (!n || n <= 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = n;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

/** "בעוד 6 ימ'" / "בעוד 3 שע'" / "פג תוקף", for an archive's retention. */
export function formatExpiry(at: Date | string | undefined): string {
    if (!at) return "";
    const ms = new Date(at).getTime() - Date.now();
    if (ms <= 0) return "פג תוקף";
    const hours = Math.round(ms / 3_600_000);
    if (hours < 24) return `פג בעוד ${hours} שע'`;
    return `פג בעוד ${Math.round(hours / 24)} ימ'`;
}
