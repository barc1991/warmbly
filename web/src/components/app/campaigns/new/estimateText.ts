// The sentences a campaign estimate is read through: when it finishes and what
// holds it back.

import type { CampaignEstimateResult } from "@/lib/api/client/app/campaigns/estimateCampaign";
import { fmtDay, plural } from "./draft";

export type Headline = { title: string; detail: string; tone: "neutral" | "warn" };

// The one sentence the estimate is about.
export function estimateHeadline(
    e: CampaignEstimateResult | undefined,
    opts: { steps: number; hasLeads: boolean; tz?: string },
): Headline | null {
    if (!e) return null;
    const { steps, hasLeads, tz } = opts;
    if (e.mailboxes === 0) {
        return {
            title: "אין תיבת דואר שיכולה לשלוח קמפיין זה",
            detail: "מאגר השולחים אינו כולל אף תיבת דואר פעילה.",
            tone: "warn",
        };
    }
    if (e.steady_capacity === 0 && e.daily_capacity === 0) {
        return {
            title: "למאגר אין קיבולת שליחה",
            detail: "כל תיבות הדואר במאגר מושהות או בהמתנה כעת.",
            tone: "warn",
        };
    }
    if (!hasLeads || e.recipients === 0) {
        return {
            title: `עד ${e.steady_capacity.toLocaleString("he-IL")} אימיילים ליום שליחה`,
            detail: hasLeads
                ? "הרשימות שנבחרו ריקות כרגע, ולכן אין אפשרות לחשב לוח זמנים."
                : "הוסף לידים כדי לקבל הערכת מועד סיום.",
            tone: hasLeads ? "warn" : "neutral",
        };
    }
    const finish = e.estimated_finish_at;
    const firstTouch = e.first_touch_finish_at;
    if (!finish) {
        return {
            title: "יותר משנתיים בקצב הנוכחי",
            detail: `${plural(e.total_sends, "אימייל", "אימיילים")} בקצב של עד ${e.steady_capacity.toLocaleString("he-IL")} ביום. הוסף תיבות דואר, הרחב את חלון השליחה או צמצם את כמות הלידים.`,
            tone: "warn",
        };
    }
    const days = e.sending_days ?? 0;
    const tone = days > 21 ? "warn" : "neutral";
    if (steps <= 1) {
        return {
            title: `כולם יקבלו את ההודעה עד ${fmtDay(finish, tz)}`,
            detail: `${plural(e.recipients, "ליד", "לידים")} על פני ${plural(Math.max(1, days), "יום שליחה", "ימי שליחה")}.`,
            tone,
        };
    }
    return {
        title: `הסיום הצפוי בסביבות ${fmtDay(finish, tz)}`,
        detail: firstTouch
            ? `כולם יקבלו את האימייל הראשון עד ${fmtDay(firstTouch, tz)}, ולאחר מכן יישלחו המעקבים עד לסיום. ${plural(e.total_sends, "אימייל", "אימיילים")} בהנחה שאיש לא ישיב.`
            : `${plural(e.total_sends, "אימייל", "אימיילים")} בהנחה שאיש לא ישיב.`,
        tone,
    };
}

// Why it takes as long as it does, in the pool's own terms.
export function bottleneckText(e: CampaignEstimateResult, tz?: string): string | null {
    switch (e.bottleneck) {
        case "warmup_graduation":
            return `${plural(e.ramping, "תיבת דואר", "תיבות דואר")} נמצאות בשלבי האצה מחימום (Ramping): נפח השליחה הקרה מתחיל נמוך ועולה ב-5 מדי יום${
                e.full_capacity_at ? `, ויגיע למהירות מלאה בסביבות ${fmtDay(e.full_capacity_at, tz)}` : ""
            }. תהליך זה שומר על מוניטין התיבות ולא ניתן לדלג עליו.`;
        case "spacing":
            return "חלון השליחה הוא הגורם המגביל: בגלל המרווח הנדרש בין שליחות, והעובדה שהחימום חולק את אותו חלון זמנים, לתיבות הדואר נגמרות השעות לפני שהן מגיעות למגבלה שלהן. חלון שליחה רחב יותר יאפשר קצב מהיר יותר.";
        case "campaign_limit":
            return "המגבלה היומית לתיבת דואר היא הגורם המגביל. הגדל אותה כדי לשלוח מהר יותר, אך מומלץ להישאר בסביבות 50 עד שמוניטין התיבות יתייצב ויוכח.";
        case "other_campaigns":
            return `תיבות דואר אלו כבר שולחות כ-${e.other_campaigns_per_day.toLocaleString("he-IL")} אימיילים ביום עבור קמפיינים אחרים, מה שחולק את המגבלות היומיות שלהן.`;
        case "health":
            return "חלק מתיבות הדואר נמצאות במעקב בריאות או בוויסות (Throttled) ושולחות בנפח מופחת עד להתאוששותן.";
        case "held":
            return `${plural(e.held, "תיבת דואר", "תיבות דואר")} אינן יכולות לשלוח כעת (עקב השהיית בריאות, כשל באימות DNS, או מנוחה), ולכן שאר התיבות נושאות בעומס הקמפיין.`;
        case "workspace_risk":
            return "רמת הסיכון של סביבת העבודה מפחיתה את נפח השליחה המותר לכל תיבת דואר.";
        case "org_daily_limit":
            return "מגבלת השליחה היומית של סביבת העבודה היא התקרה, ולא תיבות הדואר.";
        case "sending_behavior":
            return "פרופילי התנהגות השליחה של תיבות הדואר (ימי עבודה, תקרות יומיות ושעתיות) קובעים את הקצב.";
        default:
            return null;
    }
}
