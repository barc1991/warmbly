// Advisor: continuously-evaluated recommendations about deliverability,
// mailbox configuration, warmup, campaign performance, copy, and list hygiene.
// Findings are surfaced where the fix lives (the campaign, the mailbox, the
// deliverability page) rather than in a separate inbox.

export type AdvisorSeverity = "critical" | "high" | "medium" | "low";

export type AdvisorCategory =
    | "deliverability"
    | "mailbox"
    | "warmup"
    | "campaign"
    | "copy"
    | "list";

// The dashboard nav tab a finding belongs to. Drives which tab shows a badge.
export type AdvisorSurface =
    | "campaigns"
    | "emails"
    | "deliverability"
    | "contacts"
    | "analytics"
    | "settings";

export type AdvisorStatus = "open" | "snoozed" | "dismissed" | "applied" | "resolved";

// One line of the before/after shown in the fix drawer. Every one-click fix
// renders its full effect this way before the user confirms.
export interface AdvisorPreviewChange {
    field: string;
    from: string;
    to: string;
}

// One copy-pasteable value, rendered as a labelled field with a copy button.
export interface AdvisorSnippet {
    label: string;
    value: string;
    // The one caveat that trips people up on this specific field.
    note?: string;
}

export interface AdvisorAction {
    tool: string;
    args: unknown;
    label: string;
    // True when autopilot is allowed to apply this one unattended: a bounded,
    // reversible settings change that only moves in the safe direction.
    auto?: boolean;
    preview?: AdvisorPreviewChange[];
    undo?: { tool: string; args: unknown };
}

// What an agent fix reports back.
export interface AdvisorAgentResult {
    finding_id: string;
    // False when the agent read the current state and decided nothing needed
    // changing, which leaves the finding open.
    applied: boolean;
    summary: string;
    // The tools it called, in order. The checkable part of the receipt.
    steps?: string[];
}

export interface AdvisorFinding {
    id: string;
    organization_id: string;
    detector_key: string;
    category: AdvisorCategory;
    severity: AdvisorSeverity;
    surface: AdvisorSurface;

    entity_type?: string;
    entity_id?: string;
    entity_label?: string;

    // The entity this finding belongs to when it differs from the subject: a
    // step's copy problem belongs to its campaign, and the campaign row is
    // where someone goes looking for it.
    parent_type?: string;
    parent_id?: string;

    status: AdvisorStatus;
    impact: number;

    title: string;
    // How this finding names itself when several of its kind are shown
    // together, with a {count} placeholder. Empty means it always stands alone.
    group_title?: string;
    detail: string;
    remedy: string;
    // The ordered manual steps, set only by checks with no one-click fix. When
    // empty the card falls back to the remedy prose.
    steps?: string[];
    // Whether an agent can resolve this by editing something the platform owns.
    // False for anything living outside it, like a DNS record, so those show
    // their steps rather than a button that cannot succeed.
    agent_fixable?: boolean;
    // Exact values to paste somewhere Warmbly cannot reach, such as a DNS
    // record at a registrar.
    snippets?: AdvisorSnippet[];
    // False while the card carries the built-in copy rather than AI-written
    // copy. The card is fully usable either way.
    narrated: boolean;

    // The numbers the detector fired on, rendered as chips under the detail.
    evidence?: Record<string, unknown>;
    action?: AdvisorAction;

    first_seen_at: string;
    last_seen_at: string;
    snoozed_until?: string;
    applied_at?: string;
    applied_result?: string;
}

export interface AdvisorSurfaceCount {
    surface: AdvisorSurface;
    total: number;
    critical: number;
    high: number;
}

export interface AdvisorSummary {
    score: number;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    surfaces: AdvisorSurfaceCount[];
    last_run_at?: string;
}

export interface AdvisorSettings {
    organization_id: string;
    enabled: boolean;
    muted_categories: string[];
    muted_detectors: string[];
    min_severity: AdvisorSeverity;
    // Applies the auto-safe fixes without asking, as the member who switched
    // it on.
    autopilot: boolean;
    autopilot_actor_id?: string;
    updated_at: string;
}

export interface AdvisorFindingsQuery {
    surface?: AdvisorSurface;
    category?: AdvisorCategory;
    entityType?: string;
    entityId?: string;
    status?: AdvisorStatus[];
    limit?: number;
}

// Presentation tokens, kept beside the types so every advisor surface renders
// severity identically.
export const SEVERITY_LABEL: Record<AdvisorSeverity, string> = {
    critical: "קריטי",
    high: "דורש טיפול",
    medium: "מומלץ לתקן",
    low: "הצעה",
};

// Tints rather than fills. A translucent wash of the severity colour lets
// whatever is underneath (a row hover, the drawer's frosted panel) show
// through, so a chip reads as a mark on the surface instead of a sticker
// sitting on top of it.
export const SEVERITY_CHIP: Record<AdvisorSeverity, string> = {
    critical: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    medium: "bg-amber-500/10 text-amber-700 border-amber-500/25",
    low: "bg-sky-500/10 text-sky-700 border-sky-500/20",
};

export const SEVERITY_DOT: Record<AdvisorSeverity, string> = {
    critical: "bg-rose-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    low: "bg-sky-500",
};

export const SEVERITY_RANK: Record<AdvisorSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

// Tone for the inline indicator that sits on the row the problem is about. It
// has to read as a status on someone else's row rather than a control of its
// own, so it stays borderless until hovered.
export const SEVERITY_ROW: Record<AdvisorSeverity, string> = {
    critical: "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20",
    high: "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20",
    medium: "bg-amber-500/10 text-amber-700 hover:bg-amber-500/25",
    low: "bg-sky-500/10 text-sky-700 hover:bg-sky-500/20",
};

// The one-word verdict the row indicator shows. Deliberately shorter than
// SEVERITY_LABEL: a table cell has room for a word, not a phrase.
export const SEVERITY_SHORT: Record<AdvisorSeverity, string> = {
    critical: "דחוף",
    high: "לתיקון",
    medium: "לשיפור",
    low: "טיפ",
};

export const CATEGORY_LABEL: Record<AdvisorCategory, string> = {
    deliverability: "עבירות",
    mailbox: "תיבת דואר",
    warmup: "חימום",
    campaign: "קמפיין",
    copy: "תוכן וניסוח",
    list: "רשימות תפוצה",
};

// A run of findings from the same check, collapsed into one card. One
// misconfiguration repeated across twenty mailboxes should read as one problem
// with twenty subjects, not twenty problems.
export interface AdvisorGroup {
    key: string;
    // lead is the most urgent member, and supplies the shared detail and remedy.
    lead: AdvisorFinding;
    members: AdvisorFinding[];
}

// groupFindings collapses runs of the same check into one entry. A check only
// collapses if it declared a group title, and only from three members up: two
// cards naming two specific mailboxes are more useful than one card saying
// "2 mailboxes".
export function groupFindings(findings: AdvisorFinding[], minSize = 3): AdvisorGroup[] {
    const byKey = new Map<string, AdvisorFinding[]>();
    for (const f of findings) {
        const list = byKey.get(f.detector_key);
        if (list) list.push(f);
        else byKey.set(f.detector_key, [f]);
    }

    const out: AdvisorGroup[] = [];
    for (const [key, members] of byKey) {
        const collapse = members.length >= minSize && Boolean(members[0].group_title);
        if (collapse) {
            out.push({ key, lead: members[0], members });
        } else {
            for (const f of members) out.push({ key: f.id, lead: f, members: [f] });
        }
    }

    // Re-sort: a collapsed group takes the urgency of its most urgent member,
    // so a run of criticals never sinks below a single medium.
    return out.sort((a, b) => {
        const rank = SEVERITY_RANK[b.lead.severity] - SEVERITY_RANK[a.lead.severity];
        if (rank !== 0) return rank;
        if (b.members.length !== a.members.length) return b.members.length - a.members.length;
        return b.lead.impact - a.lead.impact;
    });
}

// groupTitle renders a group's heading, falling back to the lead's own title
// for a check that never declared one.
export function groupTitle(group: AdvisorGroup): string {
    if (group.members.length < 2 || !group.lead.group_title) return group.lead.title;
    return group.lead.group_title.replace("{count}", String(group.members.length));
}

// resolutionSteps is the ordered how-to for a finding with no one-click fix.
// Empty means the remedy prose is the whole answer.
export function resolutionSteps(finding: AdvisorFinding): string[] {
    return finding.steps ?? [];
}

// findingLink is the way to the screen where a manual fix is actually made. A
// step's problem sends you to its campaign, since a step has no page of its own.
export function findingLink(finding: AdvisorFinding): { href: string; label: string } | null {
    if (finding.entity_type === "campaign" && finding.entity_id) {
        return { href: `/app/campaigns/${finding.entity_id}`, label: "פתיחת הקמפיין" };
    }
    if (finding.entity_type === "step" && finding.parent_id) {
        return { href: `/app/campaigns/${finding.parent_id}`, label: "פתיחת הקמפיין" };
    }
    if (finding.entity_type === "email_account" && finding.entity_id) {
        const tab = finding.detector_key === "mailbox_domain_auth" ? "&tab=warmup" : "";
        return { href: `/app/emails?mailbox=${finding.entity_id}${tab}`, label: "פתיחת תיבת הדואר" };
    }
    switch (finding.surface) {
        case "deliverability":
            return { href: "/app/deliverability", label: "פתיחת עבירות מסירה" };
        case "contacts":
            return { href: "/app/contacts", label: "פתיחת אנשי קשר" };
        case "settings":
            return { href: "/app/settings/workspace", label: "פתיחת הגדרות סביבת העבודה" };
        default:
            return null;
    }
}

// worstSeverity is the tone a group of findings should take: the most urgent
// one present. A row with a critical and three suggestions is a critical row.
export function worstSeverity(findings: AdvisorFinding[]): AdvisorSeverity | null {
    let worst: AdvisorSeverity | null = null;
    for (const f of findings) {
        if (!worst || SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst]) worst = f.severity;
    }
    return worst;
}

// sortFindings orders a list the way every advisor surface shows it: most
// urgent first, applied ones last so a just-fixed card does not jump to the top.
export function sortFindings(findings: AdvisorFinding[]): AdvisorFinding[] {
    return [...findings].sort((a, b) => {
        if ((a.status === "applied") !== (b.status === "applied")) {
            return a.status === "applied" ? 1 : -1;
        }
        const rank = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        return rank !== 0 ? rank : b.impact - a.impact;
    });
}

// An advisor run sliced by the entity each finding is about, so a list page can
// fetch its surface once and hand every row its own advice.
export interface AdvisorEntityIndex {
    // get returns the findings attached to one entity, most urgent first.
    get(entityId?: string | null): AdvisorFinding[];
    // unattached are the findings no row can carry: workspace-wide settings, or
    // an entity that is not on this page. The page-level summary shows these.
    unattached: AdvisorFinding[];
    // total counts every finding in the run, attached or not.
    total: number;
}

const EMPTY: AdvisorFinding[] = [];

// indexByEntity buckets a run by subject AND by parent, because the row a
// finding belongs on is not always the row it is about: a step's copy problem
// has no row of its own and belongs on its campaign.
export function indexByEntity(findings: AdvisorFinding[]): AdvisorEntityIndex {
    const byEntity = new Map<string, AdvisorFinding[]>();
    const unattached: AdvisorFinding[] = [];

    const push = (id: string, f: AdvisorFinding) => {
        const list = byEntity.get(id);
        if (list) {
            // A finding whose parent is also its subject must not be listed twice.
            if (!list.some((x) => x.id === f.id)) list.push(f);
        } else {
            byEntity.set(id, [f]);
        }
    };

    for (const f of findings) {
        if (f.entity_id) push(f.entity_id, f);
        if (f.parent_id) push(f.parent_id, f);
        if (!f.entity_id && !f.parent_id) unattached.push(f);
    }

    for (const [id, list] of byEntity) byEntity.set(id, sortFindings(list));

    return {
        get: (entityId) => (entityId ? (byEntity.get(entityId) ?? EMPTY) : EMPTY),
        unattached: sortFindings(unattached),
        total: findings.length,
    };
}

const EVIDENCE_KEY_LABELS: Record<string, string> = {
    mailbox: "תיבת דואר",
    missing: "רשומות חסרות",
    spf: "SPF",
    dkim: "DKIM",
    dmarc: "DMARC",
    dmarc_policy: "מדיניות DMARC",
    currently_sending_cold: "שליחה פעילה בקמפיין",
    sending_blocked: "שליחה חסומה",
    unresolved_errors_7d: "שגיאות שלא טופלו (7 ימים)",
    status: "סטטוס",
    provider: "ספק דואר",
    daily_cap: "תקרה יומית",
    send_gap_seconds: "מרווח שליחה (שניות)",
    warmup_enabled: "חימום מופעל",
    warmup_paused: "חימום מושהה",
    campaign: "קמפיין",
    step: "שלב",
    complaints_30d: "תלונות ספאם (30 יום)",
    cold_sent_30d: "נשלחו בקמפיינים (30 יום)",
    cold_sent_7d: "נשלחו בקמפיינים (7 ימים)",
    bounce_rate: "אחוז שגיאות שליחה (Bounce)",
    complaint_rate: "אחוז תלונות ספאם",
    spam_rate: "אחוז ספאם בחימום",
    tracking_domain: "דומיין מעקב",
    tracking_domain_verified: "דומיין מעקב מאומת",
};

// Evidence keys are snake_case machine names; this renders them as readable
// Hebrew labels.
export function evidenceLabel(key: string): string {
    if (EVIDENCE_KEY_LABELS[key]) return EVIDENCE_KEY_LABELS[key];
    return key
        .replace(/_percent$/, " (%)")
        .replace(/_/g, " ")
        .replace(/\b7d\b/, "7 ימים אחרונים")
        .replace(/\b30d\b/, "30 ימים אחרונים")
        .replace(/^./, (c) => c.toUpperCase());
}

export function evidenceValue(value: unknown): string {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "כן" : "לא";
    if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
    const s = String(value);
    if (s === "none") return "ללא חסימה (none)";
    if (s === "quarantine") return "הסגר (quarantine)";
    if (s === "reject") return "דחייה (reject)";
    if (s === "active") return "פעיל";
    if (s === "paused") return "מושהה";
    if (s === "failing") return "נכשל";
    if (s === "healthy") return "תקין";
    return s;
}

export function localizeFinding(f: AdvisorFinding): AdvisorFinding {
    const copy = { ...f };
    const entity = f.entity_label || "תיבת הדואר";

    if (copy.snippets && copy.snippets.length > 0) {
        copy.snippets = copy.snippets.map((snip) => {
            let label = snip.label;
            let note = snip.note;
            if (label === "DKIM host") label = "מארח DKIM";
            else if (label === "DKIM value") label = "ערך DKIM";
            else if (label === "SPF record type") label = "סוג רשומה SPF";
            else if (label === "SPF host") label = "מארח SPF";
            else if (label === "SPF value") label = "ערך SPF";
            else if (label === "DMARC record type") label = "סוג רשומה DMARC";
            else if (label === "DMARC host") label = "מארח DMARC";
            else if (label === "DMARC value") label = "ערך DMARC";
            else if (label === "Record type") label = "סוג רשומה";
            else if (label === "Host") label = "מארח";
            else if (label === "Points to") label = "מצביע על";

            if (note) {
                if (note.includes("Google Admin > Apps > Google Workspace > Gmail > Authenticate email")) {
                    note = "מסוף הניהול Google Workspace > Gmail > Authenticate email מפיק את ערך ה-TXT.";
                } else if (note.includes("Microsoft 365 Defender > Policies > DKIM")) {
                    note = "מסוף Microsoft 365 Defender > Policies > DKIM מספק שתי רשומות CNAME.";
                } else if (note.includes("Host is the domain root")) {
                    note = "המארח הוא שורש הדומיין, אשר בחלק מספקי ה-DNS נרשם כ-@ ובאחרים נשאר ריק.";
                } else if (note.includes("Starts in monitor-only mode")) {
                    note = "מתחיל במצב ניטור בלבד (p=none). שנו ל-p=quarantine לאחר שהדוחות מאשרים שהשליחה הלגיטימית תקינה.";
                } else if (note.includes("A subdomain of the domain this mailbox sends from")) {
                    note = "תת-דומיין של הדומיין שממנו תיבה זו שולחת מיילים.";
                }
            }
            return { ...snip, label, note };
        });
    }

    switch (f.detector_key) {
        case "mailbox_domain_auth": {
            const missing = Array.isArray(f.evidence?.missing) ? (f.evidence?.missing as string[]) : [];
            const missingText = missing.length > 0 ? missing.join(", ") : "DKIM / SPF / DMARC";
            copy.title = `${entity} חסרה רשומות אימות (${missingText})`;
            copy.group_title = "{count} דומיינים חסרים רשומות אימות DNS";
            copy.detail = `דומיין השליחה של ${entity} חסר רשומות אימות (${missingText}) תקינות. כללי השליחה בנפח גבוה של גוגל וספקי הדואר דורשים תיאום מלא של SPF, DKIM ו-DMARC. ללא אימות תקין, הודעות קרות מועברות ישירות לתיקיית הספאם או נחסמות בהגעה.`;
            copy.remedy = "הוסיפו את רשומות ה-DNS החסרות אצל רשם הדומיין שלכם, ולאחר מכן בצעו בדיקה חוזרת מתוך פרטי תיבת הדואר לעדכון מידי. זהו הצעד החשוב ביותר לשיפור עבירות המסירה וללא עלות.";
            copy.steps = [
                "פתחו את ממשק ניהול ה-DNS של הדומיין שממנו נשלח הדואר. הרשומות להוספה מופיעות מטה, מוכנות להעתקה.",
                "הפיקו מפתח DKIM במסוף הניהול של ספק הדואר שלכם, פרסמו את הרשומה המתקבלת בכתובת המארח שלמטה, ולאחר מכן הפעילו את החתימה (Signing). פרסום המפתח והפעלת החתימה הן שתי פעולות נפרדות ואי-הפעלת החתימה היא הגורם הנפוץ ביותר לתקלות.",
                "הוסיפו את רשומת ה-SPF כרשומת TXT בשורש הדומיין (@). אם רשומת SPF כבר קיימת, ערכו אותה במקום להוסיף רשומה שנייה: קיום שתי רשומות SPF נחשב לכישלון אימות.",
                "הוסיפו את רשומת ה-DMARC כרשומת TXT תחת מארח _dmarc. המדיניות מתחילה ב-p=none, המנטרת בלבד ללא השפעה על מסירה; מומלץ להחמיר ל-quarantine לאחר שווידאתם בדוחות שהשליחות הלגיטימיות עוברות בהצלחה.",
                "ההפצה של שינויי DNS עשויה לארוך בין מספר דקות למספר שעות. מרבית הספקים מתעדכנים מהר יותר.",
                "שלחו הודעת בדיקה לעצמכם וודאו שבראשי ההודעה (Headers) מופיע Pass עבור כל רשומה. Warmbly בודקת את הדומיין לפי לוח זמנים עצמאי וההתראה תתנקה מעצמה ברגע שהרשומות יזוהו.",
            ];
            break;
        }
        case "mailbox_errors_unresolved": {
            const count = Number(f.evidence?.unresolved_errors_7d) || 1;
            const countText = count === 1 ? "שגיאה אחת שלא נוקתה" : `${count} שגיאות שלא נוקו`;
            copy.title = `לתיבת הדואר ${entity} יש ${countText}`;
            copy.group_title = "{count} תיבות דואר כוללות שגיאות שטרם טופלו";
            copy.detail = `לתיבת הדואר ${entity} יש ${countText} מ-7 הימים האחרונים שטרם נפתרו. שגיאות שליחה וסנכרון אינן מופיעות ככישלון בדיווחי הקמפיינים הרגילים, ולכן תיבה במצב זה שולחת בפועל פחות הודעות ממה שהוגדר מבלי שתרגישו.`;
            copy.remedy = "היכנסו לפרטי תיבת הדואר ובדקו את רשימת השגיאות. שגיאות אימות דורשות לרוב חיבור מחדש; שגיאות מגבלת קצב (Rate-limit) מעידות שהספק מגביל את השליחה ויש להפחית את המכסה היומית.";
            copy.steps = [
                "פתחו את תיבת הדואר ועיינו בשגיאות. הן מסווגות לפי סוג, והסוג מצביע על אופן התיקון.",
                "שגיאות אימות או פרטי התחברות מחייבות חיבור מחדש. טוקן OAuth שפג תוקפו או סיסמה ששונתה לא יתאוששו מעצמם.",
                "שגיאות מגבלת קצב או חסימה זמנית (Rate-limit / Throttling) מעידות שהספק מגביל את השליחה. הנמיכו את תקרת השליחה היומית והרחיבו את מרווח הזמן בין הודעות.",
                "שגיאות התחברות או פסק זמן (Timeout) נובעות לרוב מכתובת שרת או פורט שגויים. אמתו אותם מול נתוני ספק הדואר הנוכחיים.",
                "לאחר תיקון הגורם, השגיאות יפסיקו להצטבר וההתראה תימחק בבדיקה הבאה.",
            ];
            break;
        }
        case "mailbox_shared_tracking_domain": {
            copy.title = `${entity} משתמשת בדומיין מעקב משותף`;
            copy.group_title = "{count} תיבות דואר עוקבות דרך דומיין משותף";
            copy.detail = `${entity} שולחת קמפיינים ללא דומיין מעקב ייעודי מאומת משלה, כך שפיקסלי פתיחה וקישורי מעקב נשלחים דרך שרת משותף. המוניטין של שרת זה מושפע מכלל המשתמשים בו ומהווה סיכון עבירות.`;
            copy.remedy = "הפנו תת-דומיין של דומיין השליחה שלכם אל שרת המעקב באמצעות רשומת CNAME, ולאחר מכן הגדירו אותו כדומיין המעקב של תיבה זו.";
            copy.steps = [
                "בחרו תת-דומיין של הדומיין שממנו אתם שולחים (למשל track.yourdomain.com). שימוש בדומיין לא קשור אינו מקנה יתרונות מוניטין.",
                "בניהול ה-DNS שלכם, הוסיפו את רשומת ה-CNAME המופיעה מטה.",
                "פתחו את הגדרות התיבה, הזינו את תת-הדומיין בשדה דומיין המעקב, ושמרו.",
                "המתינו לאימות הרשומה (לרוב מספר דקות ועד כשעה).",
                "קישורים שנשלחו בעבר ימשיכו לעבוד, ושליחות חדשות ישתמשו אוטומטית בדומיין המעקב החדש.",
            ];
            break;
        }
        case "warmup_off_while_sending": {
            copy.title = `החימום כבוי בזמן שהתיבה שולחת קמפיינים (${entity})`;
            copy.group_title = "{count} תיבות שולחות קמפיינים ללא חימום מקביל";
            copy.detail = `${entity} משתתפת בקמפיינים פעילים אך רשת החימום שלה כבויה. חימום פעיל במקביל לשליחה קרה שומר על יחס תקין בין שליחה לקבלת תגובות ומגן על מוניטין התיבה.`;
            copy.remedy = "הפעילו את החימום עבור תיבת דואר זו כדי להגן על עבירות המסירה.";
            break;
        }
        case "warmup_paused": {
            copy.title = `חימום התיבה מושהה (${entity})`;
            copy.group_title = "{count} תיבות דואר מושהות מחימום";
            copy.detail = `תהליך החימום של ${entity} הושהה, ולכן מוניטין השליחה אינו נבנה כעת.`;
            copy.remedy = "חדשו את החימום בלחיצה אחת או מתוך פרטי התיבה.";
            break;
        }
        case "mailbox_cap_too_high": {
            copy.title = `תקרת השליחה היומית גבוהה מדי (${entity})`;
            copy.group_title = "{count} תיבות דואר מוגדרות עם מכסה גבוהה מדי";
            copy.detail = `תקרת השליחה שהוגדרה עבור ${entity} חורגת מהנפח המומלץ לגיל ולמוניטין של התיבה, מה שעלול להוביל לסימון כספאם.`;
            copy.remedy = "הפחיתו את תקרת השליחה היומית לנפח בטוח ומדורג.";
            break;
        }
        case "mailbox_gap_too_short": {
            copy.title = `מרווח הזמן בין הודעות קצר מדי (${entity})`;
            copy.group_title = "{count} תיבות שולחות במרווחי זמן קצרים מדי";
            copy.detail = `ההפרש בין שליחות הודעות מ-${entity} קצר מדי ונראה כדפוס אוטומטי חשוד בעיני ספקי הדואר.`;
            copy.remedy = "הרחיבו את מרווח הזמן בין שליחות ל-60 עד 180 שניות לפחות.";
            break;
        }
        case "mailbox_inactive_in_campaign": {
            copy.title = `תיבת דואר אינה פעילה בקמפיין המקושר (${entity})`;
            copy.group_title = "{count} תיבות אינן פעילות בקמפיינים מקושרים";
            copy.detail = `${entity} מוגדרת כחלק מקמפיין פעיל אך שליחתה מושבתת או מושהית.`;
            copy.remedy = "הפעילו את התיבה או הסירו אותה מהקמפיין כדי לא לפגוע בקצב השליחה.";
            break;
        }
        case "mailbox_complaint_rate": {
            copy.title = `שיעור תלונות ספאם חריג ב-${entity}`;
            copy.group_title = "{count} תיבות דואר מקבלות שיעור תלונות ספאם גבוה";
            copy.detail = `אחוז הנמענים שסימנו את הודעות ${entity} כספאם עולה על הרף המותר (מעל 0.1%). המשך שליחה בקצב זה יפגע קשות בעבירות המסירה.`;
            copy.remedy = "בדקו את איכות רשימות התפוצה, ודאו הסכמה מוקדמת, והוסיפו קישור הסרה בולט.";
            break;
        }
        case "mailbox_bounce_rate": {
            copy.title = `שיעור שגיאות מסירה (Bounce) גבוה ב-${entity}`;
            copy.group_title = "{count} תיבות סובלות משיעור החזרות (Bounce) גבוה";
            copy.detail = `אחוז גבוה מדי של הודעות מוחזרות עקב כתובות לא קיימות או שגויות. הדבר פוגע באופן מידי במוניטין הדומיין.`;
            copy.remedy = "נקו את רשימות התפוצה ואמתו את הכתובות לפני השליחה.";
            break;
        }
        case "mailbox_spam_placement": {
            copy.title = `הודעות מנותבות לתיקיית הספאם (${entity})`;
            copy.group_title = "{count} תיבות דואר סובלות מניתוב לספאם";
            copy.detail = `בדיקות החימום מראות שחלק משמעותי מההודעות הנשלחות מ-${entity} מגיעות לתיקיית הספאם במקום לתיבת הדואר הנכנס.`;
            copy.remedy = "הורידו את נפח השליחה הקרה, הגבירו את יחס החימום ובדקו את תאימות תוכן ההודעות ורשומות ה-DNS.";
            break;
        }
        case "campaign_no_followups": {
            copy.title = "לקמפיין אין הודעות המשך (Follow-ups)";
            copy.detail = "הקמפיין כולל שלב ראשון בלבד. מרבית התגובות והעסקאות בדוא\"ל קר מגיעות בהודעות ההמשך (שלבים 2-4).";
            copy.remedy = "הוסיפו שלבי המשך (Follow-up) לקמפיין כדי להעלות משמעותית את שיעור המענה.";
            break;
        }
        case "campaign_reply_rate_low": {
            copy.title = "שיעור מענה נמוך בקמפיין";
            copy.detail = "שיעור המענה לקמפיין נמוך מהממוצע. ייתכן שהניסוח אינו ממוקד, שורת הנושא אינה מותאמת, או שההצעה אינה אטרקטיבית לנמענים.";
            copy.remedy = "בצעו מבחני A/B לשורת הנושא, קצרו את גוף ההודעה והדגישו קריאה ברורה ופשוטה לפעולה (CTA).";
            break;
        }
        case "campaign_step_dropoff": {
            copy.title = "נשירה חדה בין שלבי הקמפיין";
            copy.detail = "זוהתה ירידה חדה באחוזי הפתיחה או המענה בין שלבים עוקבים בקמפיין.";
            copy.remedy = "רעננו את תוכן הודעות ההמשך וספקו ערך מוסף חדש בכל הודעה במקום תזכורת גנרית.";
            break;
        }
        case "campaign_unsubscribe_header_off": {
            copy.title = "כותרת ביטול מנוי בלחיצה אחת (List-Unsubscribe) כבויה";
            copy.detail = "גוגל ו-Yahoo דורשות תמיכה ב-One-Click Unsubscribe עבור שולחים בנפח גבוה. בלעדיה, נמענים לוחצים על \"דווח כספאם\".";
            copy.remedy = "הפעילו את כותרת ביטול המנוי בהגדרות הקמפיין.";
            break;
        }
        case "campaign_no_senders": {
            copy.title = "לקמפיין אין תיבות דואר שולחות מוקצות";
            copy.detail = "הקמפיין מוגדר לפעול אך לא הוקצתה לו אף תיבת דואר פעילה, ולכן לא נשלחות הודעות.";
            copy.remedy = "הקצו תיבות דואר שולחות לקמפיין כדי להתחיל בשליחה.";
            break;
        }
        case "campaign_capacity_shortfall": {
            copy.title = "מחסור בקיבולת שליחה ביחס לכמות הנמענים";
            copy.detail = "מספר הלידים ברשימת הקמפיין עולה על כושר השליחה היומי של התיבות המוקצות לו, מה שיוביל לעיכובים ממושכים.";
            copy.remedy = "הקצו תיבות דואר נוספות לקמפיין או הגדילו בהדרגה את מכסת התיבות הוותיקות.";
            break;
        }
        case "campaign_no_ab_test": {
            copy.title = "הקמפיין אינו משתמש בבדיקות A/B";
            copy.detail = "שליחת גרסה בודדת ללא בדיקת חלופות מונעת אופטימיזציה של אחוזי פתיחה ומענה.";
            copy.remedy = "הוסיפו גרסת בדיקה (Variant B) לשורת הנושא או לגוף המייל.";
            break;
        }
        case "campaign_narrow_window": {
            copy.title = "חלון זמני שליחה צר מדי";
            copy.detail = "חלון השליחה היומי שהוגדר קצר מדי ומאלץ שליחה צפופה שעלולה להעלות חשד אצל ספקי הדואר.";
            copy.remedy = "הרחיבו את שעות פעילות השליחה לאורך שעות העבודה המקובלות (למשל 09:00 עד 17:00).";
            break;
        }
        case "list_role_addresses": {
            copy.title = "רשימת התפוצה כוללת כתובות תפקיד (info@, sales@)";
            copy.detail = "כתובות גנריות (כגון admin@, info@, contact@) מגיעות לצוותים מרובים ומניבות שיעור תלונות ספאם גבוה.";
            copy.remedy = "הסירו או סננו כתובות תפקיד והתמקדו בפנייה לכתובות אישיות ומאומתות.";
            break;
        }
        case "list_free_mail_heavy": {
            copy.title = "שיעור גבוה של כתובות דואר חינמיות (Gmail, Yahoo)";
            copy.detail = "הרשימה כוללת נתח גבוה של כתובות פרטיות ולא עסקיות, המאופיינות בעבירות מסירה נמוכה יותר בפנייה עסקית קרה.";
            copy.remedy = "תעדפו כתובות דוא\"ל עסקיות בעלות דומיין ייעודי (B2B).";
            break;
        }
        case "list_suppressed_share": {
            copy.title = "נמענים חסומים או מוסרים נמצאים ברשימה";
            copy.detail = "הרשימה מכילה כתובות הנמצאות ברשימת ההשחרה/דיכוי (Suppression list). שליחה אליהן מסוכנת למוניטין.";
            copy.remedy = "הפעילו ניקוי רשימה אוטומטי להסרת נמענים מדוכאים.";
            break;
        }
        case "list_unsubscribed_enrolled": {
            copy.title = "נמענים שביקשו הסרה צורפו לקמפיין";
            copy.detail = "זוהו נמענים שהסירו עצמם בעבר ורשומים כעת לשליחה חוזרת.";
            copy.remedy = "הסירו מיד נמענים אלו כדי למנוע תלונות ואי-עמידה בתקנות הספאם.";
            break;
        }
        case "copy_broken_template": {
            copy.title = "משתנה תבנית לא תקין או חסר";
            copy.detail = "בגוף ההודעה מופיעים תגי משתנים (כגון {{first_name}}) שאינם קיימים בנתוני אנשי הקשר או כתובים בשגיאת תחביר.";
            copy.remedy = "תקנו את שמות המשתנים בתבנית והגדירו ערך ברירת מחדל (Fallback).";
            break;
        }
        case "copy_spam_phrases": {
            copy.title = "זוהו ביטויי ספאם בתוכן ההודעה";
            copy.detail = "ההודעה מכילה מילים המפעילות מסנני ספאם (כגון \"חינם\", \"הזדמנות בלתי חוזרת\", \"100% רווח\").";
            copy.remedy = "החליפו את הביטויים המודגשים בניסוח מקצועי וענייני יותר.";
            break;
        }
        case "copy_too_long": {
            copy.title = "תוכן ההודעה ארוך מדי";
            copy.detail = "אורך ההודעה עולה על 150 מילים. הודעות פנייה קרה קצרות וממוקדות משיגות אחוזי קריאה ומענה גבוהים משמעותית.";
            copy.remedy = "קצרו את ההודעה ל-50 עד 125 מילים והתמקדו בהצגת ערך אחת וקריאה ברורה לפעולה.";
            break;
        }
        case "copy_subject_too_long": {
            copy.title = "שורת הנושא ארוכה מדי";
            copy.detail = "שורת הנושא מכילה מעל 60 תווים ועלולה להיחתך במסכי טלפונים ניידים.";
            copy.remedy = "קצרו את שורת הנושא ל-2 עד 6 מילים (עד 40 תווים) לקבלת תצוגה מיטבית.";
            break;
        }
        case "copy_too_many_links": {
            copy.title = "יותר מדי קישורים בהודעה";
            copy.detail = "ההודעה כוללת ריבוי קישורים חיצוניים, המהווה סממן מובהק לספאם בעיני מערכות סינון הדואר.";
            copy.remedy = "הגבילו את מספר הקישורים לקישור יחיד לכל היותר (או ללא קישורים בשלב הראשון).";
            break;
        }
        case "copy_shouty_subject": {
            copy.title = "אותיות רישיות או סימני קריאה מרובים בשורת הנושא";
            copy.detail = "שורת הנושא מכילה אותיות גדולות ברצף (ALL CAPS) או סימני קריאה מרובים (!!!).";
            copy.remedy = "שנו את שורת הנושא לאותיות רגילות וניסוח שקט ומקצועי.";
            break;
        }
    }

    return copy;
}
