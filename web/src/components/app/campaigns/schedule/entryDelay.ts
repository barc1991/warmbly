// Vocabulary for the campaign's entry delay — how long a contact's FIRST email
// waits after they entered the campaign. Kept apart from the picker component so
// the Schedule tab, the flow canvas and any future surface share one wording.

// Ceiling mirrors validate.CampaignEntryDelayMaxMinutes and the column's CHECK.
export const ENTRY_DELAY_MAX_MINUTES = 90 * 24 * 60;

export const ENTRY_DELAY_PRESETS: { label: string; minutes: number }[] = [
    { label: "מיידית", minutes: 0 },
    { label: "שעה אחת", minutes: 60 },
    { label: "4 שעות", minutes: 240 },
    { label: "יום אחד", minutes: 1440 },
    { label: "יומיים", minutes: 2880 },
    { label: "3 ימים", minutes: 4320 },
    { label: "שבוע אחד", minutes: 10080 },
];

export const ENTRY_DELAY_UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;
export type EntryDelayUnit = keyof typeof ENTRY_DELAY_UNIT_MINUTES;

// Largest whole unit the value divides into, so 2880 reads as "2 days".
export function splitEntryDelay(minutes: number): { amount: number; unit: EntryDelayUnit } {
    if (minutes > 0 && minutes % ENTRY_DELAY_UNIT_MINUTES.days === 0) {
        return { amount: minutes / ENTRY_DELAY_UNIT_MINUTES.days, unit: "days" };
    }
    if (minutes > 0 && minutes % ENTRY_DELAY_UNIT_MINUTES.hours === 0) {
        return { amount: minutes / ENTRY_DELAY_UNIT_MINUTES.hours, unit: "hours" };
    }
    return { amount: minutes, unit: "minutes" };
}

/** "מיידית", "יומיים", "90 דקות" — the phrase every surface shows. */
export function entryDelayLabel(minutes: number): string {
    if (minutes <= 0) return "מיידית";
    const preset = ENTRY_DELAY_PRESETS.find((p) => p.minutes === minutes);
    if (preset) return preset.label;
    const { amount, unit } = splitEntryDelay(minutes);
    if (unit === "days") {
        if (amount === 1) return "יום אחד";
        if (amount === 2) return "יומיים";
        return `${amount} ימים`;
    }
    if (unit === "hours") {
        if (amount === 1) return "שעה אחת";
        if (amount === 2) return "שעתיים";
        return `${amount} שעות`;
    }
    if (amount === 1) return "דקה אחת";
    return `${amount} דקות`;
}

