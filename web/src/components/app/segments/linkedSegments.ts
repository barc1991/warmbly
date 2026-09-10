// How a campaign's linked segments relate to it right now, shared by the
// Leads tab strip, its empty state and the link dialog's toast.

import type { CampaignSegmentLink } from "@/lib/api/models/app/segments/Segment";

export function linkSummary(l: CampaignSegmentLink): string {
    if (l.contact_count === 0) return "אינו מתאים לאנשי קשר כרגע";
    const members = `${l.contact_count.toLocaleString()} ${l.contact_count === 1 ? "חבר" : "חברים"}`;
    const held =
        l.held_out_count > 0
            ? `, ${l.held_out_count.toLocaleString()} הוסרו ידנית ומוחזקים בחוץ`
            : "";
    if (l.lead_count === l.contact_count) return `${members}, כולם לידים${held}`;
    return `${members}, ${l.lead_count.toLocaleString()} מתוכם לידים${held}`;
}

export function linkTotals(links: CampaignSegmentLink[]): { members: number; held: number } {
    return {
        members: links.reduce((n, l) => n + l.contact_count, 0),
        held: links.reduce((n, l) => n + l.held_out_count, 0),
    };
}

// Why linked segments added no leads: empty, held out, or nothing yet.
export function linksEmptyReason(links: CampaignSegmentLink[]): string {
    const names = links.map((l) => l.name).join(", ");
    const { members, held } = linkTotals(links);
    if (members === 0) {
        return `${names} ${links.length === 1 ? "אינו כולל" : "אינם כוללים"} אנשי קשר כרגע. לידים יצטרפו אוטומטית כשאנשי קשר יתווספו לסגמנט.`;
    }
    if (held > 0) {
        return `${held.toLocaleString()} ${held === 1 ? "חבר" : "חברים"} מתוך ${names} הוסרו מקמפיין זה ידנית, ולכן הרישום האוטומטי משאיר אותם בחוץ עד שתוסיף אותם חזרה.`;
    }
    return `${links.map(linkSummary).join("; ")}. חברים יירשמו אוטומטית תוך מספר דקות.`;
}
