import type ContactCampaignState from "@/lib/api/models/app/contacts/ContactCampaignState";

// Pausable only while the scheduler reports a next step; a failed preview counts as no.
export function leadCanBePaused(state: ContactCampaignState): boolean {
    return !state.hold && !state.ended_reason && !!state.next && state.campaign_status !== "completed";
}

// "yyyy-MM-dd" for the member's local day `days` after `from`.
export function localDayISO(days: number, from: Date = new Date()): string {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// End of that local day, so "pause until the 8th" still covers the 8th.
export function endOfLocalDay(iso: string): string | null {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 23, 59, 59, 0).toISOString();
}

// A reply's follow-up pause; `days` null has no end and only a resume lifts it.
export interface FollowUpPause {
    label: string;
    short: string;
    days: number | null;
}

export const FOLLOW_UP_PAUSES: FollowUpPause[] = [
    { label: "ל-3 ימים", short: "3 ימים", days: 3 },
    { label: "לשבוע אחד", short: "שבוע", days: 7 },
    { label: "לשבועיים", short: "שבועיים", days: 14 },
    { label: "ל-30 ימים", short: "30 ימים", days: 30 },
    { label: "עד שאחדש ידנית", short: "עד חידוש", days: null },
];

// Counted from when the reply goes out, so a scheduled reply is covered too.
export function followUpPauseUntil(p: FollowUpPause, from: Date = new Date()): string | null {
    return p.days == null ? null : endOfLocalDay(localDayISO(p.days, from));
}

// The campaigns a pause applies to: the unticked are skipped, but never all of them.
export function tickedCampaigns<T extends { campaign_id: string }>(campaigns: T[], skipped: string[]): T[] {
    const ticked = campaigns.filter((c) => !skipped.includes(c.campaign_id));
    return ticked.length > 0 ? ticked : campaigns;
}

// Resuming a lead held because it is copied on another lead's thread starts a
// second sequence to the same person, which the hold exists to prevent.
export const CC_RESUME_CONFIRM =
    "להפעיל גם את הרצף של איש קשר זה? הוא יקבל שני שרשורים מקמפיין זה: את השרשור שלו, ואת זה שהוא מועתק אליו (CC).";

