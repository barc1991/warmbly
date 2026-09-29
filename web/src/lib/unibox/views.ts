// Premade inbox views: a handful of questions a pipeline turns on, each
// answered by a set of the automatic labels. A view is a client-side scope
// over the labels the workspace already has (the server filters on
// category_ids with OR semantics), so it needs no table and no migration, and
// it works the moment the labels exist, which is when the workspace is created.
//
// Membership is by label name, the same words policy.go writes, so the view
// and the classifier cannot disagree about what "hot" means.

import type { UniboxCategoryOverview } from "@/lib/api/models/app/unibox/UniboxOverview";

export type UniboxViewId = "action_required" | "hot" | "needs_reply" | "follow_up" | "declined" | "automated";

export interface UniboxView {
    id: UniboxViewId;
    label: string;
    /** The one-line meaning shown on hover. */
    meaning: string;
    /** Label names a thread needs at least one of. */
    labels: string[];
    /**
     * When true, the view is backed by the server's `automated` filter rather
     * than by `category_ids`, because normal list queries exclude automated
     * mail before `category_ids` is checked.
     */
    automated?: boolean;
}

export const UNIBOX_VIEWS: UniboxView[] = [
    {
        id: "action_required",
        label: "דורש טיפול",
        meaning: "הודעות אוטומטיות שדורשות התערבות: תשלום שנכשל, חשבון מושהה, התחברות חשודה, מגבלת שליחה או שירות שעומד לפוג. נשמרות בתיבת הדואר הנכנס כדי שלא יוחמצו.",
        labels: ["action required"],
    },
    {
        id: "hot",
        label: "לידים חמים",
        meaning: "תשובות שהביעו עניין, הציעו מועד לפגישה, ביקשו שיחה או שאלו על מחיר.",
        labels: ["interested", "meeting", "wants call", "pricing"],
    },
    {
        id: "needs_reply",
        label: "דורש מענה",
        meaning: "הם כתבו אחרונים ואף אחד לא השיב במשך יומיים או יותר.",
        labels: ["needs reply"],
    },
    {
        id: "follow_up",
        label: "פולו-אפ",
        meaning: "כתבת אחרון ולא התקבלה תגובה, או ששיחה בעלת עניין נהייתה שקטה.",
        labels: ["follow up", "gone quiet"],
    },
    {
        id: "declined",
        label: "לא מעוניינים",
        meaning: "לא מעוניינים, האדם הלא נכון, או שביקשו הסרה. לא ייווצר עמם קשר שוב.",
        labels: ["not interested", "wrong person", "unsubscribed", "remove me"],
    },
    {
        id: "automated",
        label: "אוטומטי",
        meaning: "קודי אימות, קבלות, ניוזלטרים, החזרות ומענים אוטומטיים. נשמרים מחוץ לתיבה הנכנסת משום שאף אדם לא כתב אותם. כל הודעה שדורשת פעולה מצדך נשארת בתיבה הנכנסת.",
        labels: ["bounced", "out of office", "auto-reply", "notification"],
        automated: true,
    },
];

export function viewById(id: string | null | undefined): UniboxView | undefined {
    return UNIBOX_VIEWS.find((v) => v.id === id);
}

/** The workspace's category rows that belong to a view, by name. */
export function viewCategories(view: UniboxView, categories: UniboxCategoryOverview[] | undefined): UniboxCategoryOverview[] {
    if (!categories) return [];
    const wanted = new Set(view.labels);
    return categories.filter((c) => wanted.has(c.title.trim().toLowerCase()));
}

/**
 * The category ids a view resolves to. A view whose labels do not exist yet
 * returns the nil id, which matches nothing, so the list is empty rather than
 * unfiltered.
 */
export function viewCategoryIds(view: UniboxView, categories: UniboxCategoryOverview[] | undefined): string[] {
    const ids = viewCategories(view, categories).map((c) => c.id);
    return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}
