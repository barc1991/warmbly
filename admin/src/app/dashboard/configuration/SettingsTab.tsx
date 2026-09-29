// Configuration, settings: the only writable configuration in the product.
// These keys are deliberately disjoint from the environment, so there is no
// precedence to resolve and nothing here can be overwritten at the next boot.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    getInstanceSettings,
    putInstanceSettings,
    type InstanceSettings,
} from "@/lib/api/client/admin/instance";

const SETTINGS_KEY = ["admin", "instance", "settings"];

// The backend clamps to the same band; matching it here keeps the operator
// from spending a round-trip to learn the range.
const TTL_MIN_HOURS = 1;
const TTL_MAX_HOURS = 720;

// Sending-domain authentication grace, mirroring internal/app/instancesettings.
const AUTH_GRACE_MIN_HOURS = 1;
const AUTH_GRACE_MAX_HOURS = 720;

// Mailbox sync fair-use bands, mirroring internal/config/constants.go.
const SYNC_FIELDS = [
    {
        key: "backfillDays",
        setting: "backfill_days",
        label: "חלון ייבוא (ימים)",
        min: 1,
        max: 730,
        help: "כמה ימים אחורה מגיע הייבוא הראשוני בעת חיבור תיבת דואר. ההודעות החדשות ביותר מיובאות תחילה.",
    },
    {
        key: "backfillMessages",
        setting: "backfill_messages",
        label: "תקרת ייבוא (הודעות לתיבת דואר)",
        min: 1,
        max: 100000,
        help: "מספר ההודעות המרבי שהייבוא הראשוני שומר עבור תיבת דואר אחת, ללא תלות בטווח הימים.",
    },
    {
        key: "dailyPerMailbox",
        setting: "daily_messages_per_mailbox",
        label: "תקציב יומי (הודעות לתיבת דואר)",
        min: 1,
        max: 100000,
        help: "כמות הדואר החדש שתיבת דואר אחת רשאית לשמור בכל יום (UTC). מעבר לכך, הדואר ממתין ליום הבא; לתשובות להודעות שנשלחו מהתיבה עצמה יש תקציב נפרד בגודל זהה והן ממשיכות להיקלט.",
    },
    {
        key: "dailyPerOrg",
        setting: "daily_messages_per_org",
        label: "תקציב יומי (הודעות לארגון)",
        min: 1,
        max: 2000000,
        help: "סך הדואר החדש והמיובא בכל הארגון ביום (UTC).",
    },
] as const;

type SyncFieldKey = (typeof SYNC_FIELDS)[number]["key"];

// Retention windows, mirroring internal/config/constants.go. Each one is also
// how long the personal data in that log is held, so the help text says what
// the data is rather than only what the number does.
const RETENTION_MIN_DAYS = 1;
const RETENTION_MAX_DAYS = 3650;

const RETENTION_FIELDS = [
    {
        key: "engagementDays",
        setting: "engagement_event_days",
        label: "פתיחות ולחיצות (ימים)",
        help: "יומני פתיחות ולחיצות ברמת אירוע בודד, כולל תוכנת הדואר, המכשיר והמיקום המשוער של כל אירוע. ספירות וניתוב בקמפיינים קוראים מסיכום נפרד שלעולם אינו נמחק, כך שקיצור טווח זה משנה את מה שציר הזמן של איש קשר מציג, ולא את פעולת הקמפיין.",
    },
    {
        key: "formDays",
        setting: "form_event_days",
        label: "אירועי משפך טפסים (ימים)",
        help: "צפיות, התחלות מילוי, נטישה ברמת שדה והגשות עבור טפסים מתארחים. דוחות משפך מציגים עד 90 ימים, כך שערך נמוך מזה יקצר גם את הדוח. אנשי קשר שהגישו טופס אינם מושפעים.",
    },
    {
        key: "auditDays",
        setting: "audit_log_days",
        label: "יומן ביקורת (ימים)",
        help: "מי ביצע מה, מאיזו כתובת IP ודפדפן (User Agent), יחד עם פרטי השינוי. חלון זה קובע למשך כמה זמן נשמרת הרשומה, והוא לרוב מוכתב על ידי מדיניות שמירת נתונים.",
    },
] as const;

type RetentionFieldKey = (typeof RETENTION_FIELDS)[number]["key"];

// The two presets are the ends of the band people actually choose between.
const RETENTION_PRESETS = [
    {
        id: "default",
        label: "ברירות מחדל",
        description: "365 / 180 / 90 ימים",
        values: { engagementDays: "365", formDays: "180", auditDays: "90" },
    },
    {
        id: "minimal",
        label: "שמירה מינימלית",
        description: "30 / 30 / 30 ימים",
        values: { engagementDays: "30", formDays: "30", auditDays: "30" },
    },
] as const;

// Engagement-classification windows, mirroring internal/config/constants.go.
// The clock starts when the send is handed to a worker, which is why these are
// larger than "how fast could a person read this": the window also has to
// cover provider queueing and transit before the recipient's gateway sees it.
const MACHINE_WINDOW_MIN_SECONDS = 1;
const MACHINE_WINDOW_MAX_SECONDS = 900;
// The probable window has bounds of its own and reaches a day, because how
// long a security vendor takes to detonate a link is the vendor's property,
// not this instance's.
const PROBABLE_WINDOW_MAX_SECONDS = 86400;

const TRACKING_FIELDS = [
    {
        key: "machineWindowOpen",
        setting: "machine_window_open_seconds",
        label: "חלון פתיחה אוטומטית (שניות)",
        min: MACHINE_WINDOW_MIN_SECONDS,
        max: MACHINE_WINDOW_MAX_SECONDS,
        help: "פתיחה המתקבלת תוך פרק זמן זה מרגע שליחת ההודעה נרשמת כאוטומטית (בוט/סורק). העלה את הערך כאשר סורקי אבטחה בזמן המסירה נספרים כפתיחות, והורד אותו כאשר נמענים שקוראים מיד מתפספסים.",
    },
    {
        key: "machineWindowClick",
        setting: "machine_window_click_seconds",
        label: "חלון לחיצה אוטומטית (שניות)",
        min: MACHINE_WINDOW_MIN_SECONDS,
        max: MACHINE_WINDOW_MAX_SECONDS,
        help: "אותו חלון עבור לחיצות, המופרד מכיוון שלשתי הטעויות יש מחיר שונה: פתיחה שסווגה בטעות מאבדת מדד סטטיסטי, בעוד לחיצה שסווגה בטעות מפסידה אוטומציה של ליד מתעניין.",
    },
    {
        key: "machineWindowProbable",
        setting: "machine_window_probable_seconds",
        label: "חלון סורק משוער (שניות)",
        min: MACHINE_WINDOW_MIN_SECONDS,
        max: PROBABLE_WINDOW_MAX_SECONDS,
        help: "משמש במקום שני החלונות שלעיל כאשר הבקשה מגיעה מרשת אבטחת דואר שגם מציגה עמודים שנלחצו עבור אנשים אמיתיים (כפי שעושות Proofpoint ו-Mimecast באמצעות בידוד דפדפן). בתוך חלון זה האירוע מסווג כסריקה בזמן מסירה; לאחריו, כנמען שניגש להודעה מאוחר יותר. נמען מאחורי אחד הספקים הללו שבאמת לוחץ בתוך החלון יירשם כאוטומטי, לכן העלה את הערך אם הסריקות שלהם עדיין נספרות כמעורבות, והורד אותו אם נמענים מהירים מתפספסים. חלון זה לעולם אינו קצר מהחלונות שלעיל.",
    },
] as const;

type TrackingFieldKey = (typeof TRACKING_FIELDS)[number]["key"];

// Inbox placement test allowance and pacing, mirroring internal/config/constants.go.
const PLACEMENT_FIELDS = [
    {
        key: "testsTrial",
        setting: "tests_per_month_trial",
        label: "בדיקות לחודש בתקופת ניסיון",
        min: 1,
        max: 100000,
        help: "כמה בדיקות רשאית סביבת עבודה ללא מסלול בתשלום להריץ על הפאנלים המנוטרים בכל חודש קלנדרי.",
    },
    {
        key: "testsPaid",
        setting: "tests_per_month_paid",
        label: "בדיקות לחודש במסלולים בתשלום",
        min: 1,
        max: 100000,
        help: "אותה מכסה עבור סביבת עבודה עם מנוי פעיל.",
    },
    {
        key: "seedsPerTest",
        setting: "seeds_per_test",
        label: "תיבות בדיקה לכל בדיקה",
        min: 1,
        max: 100,
        help: "מספר תיבות הבדיקה המרבי שבדיקה אחת שולחת אליהן, שהוא גם מספר השליחות שהיא צורכת מהמגבלה היומית של תיבת הדואר השולחת. גודל הבדיקה מצטמצם לפי המכסה היומית שנותרה לתיבה היום, והבדיקה נדחית אם נותרו פחות מחמש תיבות.",
    },
    {
        key: "spacingSeconds",
        setting: "spacing_seconds",
        label: "מרווח בין עותקים (שניות)",
        min: 5,
        max: 600,
        help: "פער הזמן בין שני עותקים הנשלחים מאותה תיבת דואר (עם אקראיות קלה), כך שהבדיקה לעולם אינה יוצאת כפרץ שליחות פתאומי.",
    },
] as const;

type PlacementFieldKey = (typeof PLACEMENT_FIELDS)[number]["key"];

// A backend from before the placement section omits it; the form shows the compiled defaults.
const PLACEMENT_DEFAULTS: InstanceSettings["placement"] = {
    tests_per_month_trial: 3,
    tests_per_month_paid: 40,
    seeds_per_test: 20,
    spacing_seconds: 60,
};

interface FormState {
    linksEnabled: boolean;
    ttlHours: string;
    allowInvitedSignup: boolean;
    sync: Record<SyncFieldKey, string>;
    retention: Record<RetentionFieldKey, string>;
    tracking: Record<TrackingFieldKey, string>;
    placement: Record<PlacementFieldKey, string>;
    enforceDomainAuth: boolean;
    authGraceHours: string;
}

function toForm(s: InstanceSettings): FormState {
    const placement = s.placement ?? PLACEMENT_DEFAULTS;
    return {
        linksEnabled: s.invitations.links_enabled,
        ttlHours: String(s.invitations.ttl_hours),
        allowInvitedSignup: s.access.allow_invited_signup,
        sync: {
            backfillDays: String(s.sync.backfill_days),
            backfillMessages: String(s.sync.backfill_messages),
            dailyPerMailbox: String(s.sync.daily_messages_per_mailbox),
            dailyPerOrg: String(s.sync.daily_messages_per_org),
        },
        retention: {
            engagementDays: String(s.retention.engagement_event_days),
            formDays: String(s.retention.form_event_days),
            auditDays: String(s.retention.audit_log_days),
        },
        tracking: {
            machineWindowOpen: String(s.tracking.machine_window_open_seconds),
            machineWindowClick: String(s.tracking.machine_window_click_seconds),
            machineWindowProbable: String(s.tracking.machine_window_probable_seconds),
        },
        placement: {
            testsTrial: String(placement.tests_per_month_trial),
            testsPaid: String(placement.tests_per_month_paid),
            seedsPerTest: String(placement.seeds_per_test),
            spacingSeconds: String(placement.spacing_seconds),
        },
        enforceDomainAuth: s.deliverability.enforce_domain_auth,
        authGraceHours: String(s.deliverability.auth_grace_hours),
    };
}

function syncFieldValid(raw: string, min: number, max: number): boolean {
    const n = Number(raw);
    return raw.trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
}

interface SettingsTabProps {
    // Reported on every change so the page can confirm before a tab switch or
    // a navigation throws the edits away.
    onDirtyChange?: (dirty: boolean) => void;
    onSwitchTab?: (tab: "environment" | "limits") => void;
}

export function SettingsTab({ onDirtyChange, onSwitchTab }: SettingsTabProps) {
    const qc = useQueryClient();
    const [form, setForm] = useState<FormState | null>(null);

    const settingsQ = useQuery({
        queryKey: SETTINGS_KEY,
        queryFn: getInstanceSettings,
        retry: false,
    });

    // Reseed whenever a fresh document arrives so a background refetch does
    // not silently keep an operator editing a stale form.
    useEffect(() => {
        if (settingsQ.data) setForm(toForm(settingsQ.data));
    }, [settingsQ.data]);

    const saveMut = useMutation({
        mutationFn: (body: InstanceSettings) => putInstanceSettings(body),
        onSuccess: (saved) => {
            qc.setQueryData(SETTINGS_KEY, saved);
            setForm(toForm(saved));
            toast.success("הגדרות המופע נשמרו");
        },
        onError: (err: Error) => toast.error(err.message || "לא ניתן לשמור את ההגדרות"),
    });

    const server = settingsQ.data;
    const syncDirty =
        !!server &&
        !!form &&
        SYNC_FIELDS.some((f) => form.sync[f.key] !== String(server.sync[f.setting]));
    const retentionDirty =
        !!server &&
        !!form &&
        RETENTION_FIELDS.some(
            (f) => form.retention[f.key] !== String(server.retention[f.setting]),
        );
    const trackingDirty =
        !!server &&
        !!form &&
        TRACKING_FIELDS.some((f) => form.tracking[f.key] !== String(server.tracking[f.setting]));
    const placementDirty =
        !!server &&
        !!form &&
        PLACEMENT_FIELDS.some(
            (f) =>
                form.placement[f.key] !== String((server.placement ?? PLACEMENT_DEFAULTS)[f.setting]),
        );
    const dirty =
        !!server &&
        !!form &&
        (form.linksEnabled !== server.invitations.links_enabled ||
            form.ttlHours !== String(server.invitations.ttl_hours) ||
            form.allowInvitedSignup !== server.access.allow_invited_signup ||
            form.enforceDomainAuth !== server.deliverability.enforce_domain_auth ||
            form.authGraceHours !== String(server.deliverability.auth_grace_hours) ||
            retentionDirty ||
            trackingDirty ||
            placementDirty ||
            syncDirty);

    useEffect(() => {
        onDirtyChange?.(dirty);
        return () => onDirtyChange?.(false);
    }, [dirty, onDirtyChange]);
    const syncValid =
        form !== null && SYNC_FIELDS.every((f) => syncFieldValid(form.sync[f.key], f.min, f.max));
    const retentionValid =
        form !== null &&
        RETENTION_FIELDS.every((f) =>
            syncFieldValid(form.retention[f.key], RETENTION_MIN_DAYS, RETENTION_MAX_DAYS),
        );

    const trackingValid =
        form !== null &&
        TRACKING_FIELDS.every((f) => syncFieldValid(form.tracking[f.key], f.min, f.max));

    const placementValid =
        form !== null &&
        PLACEMENT_FIELDS.every((f) => syncFieldValid(form.placement[f.key], f.min, f.max));

    const authGrace = form ? Number(form.authGraceHours) : NaN;
    const authGraceValid =
        form !== null &&
        form.authGraceHours.trim() !== "" &&
        Number.isInteger(authGrace) &&
        authGrace >= AUTH_GRACE_MIN_HOURS &&
        authGrace <= AUTH_GRACE_MAX_HOURS;

    const ttl = form ? Number(form.ttlHours) : NaN;
    const ttlValid =
        form !== null &&
        form.ttlHours.trim() !== "" &&
        Number.isInteger(ttl) &&
        ttl >= TTL_MIN_HOURS &&
        ttl <= TTL_MAX_HOURS;

    function save() {
        if (!form) return;
        if (!ttlValid) {
            toast.error(
                `תוקף ההזמנה חייב להיות מספר שלם של שעות בין ${TTL_MIN_HOURS} ל-${TTL_MAX_HOURS}`,
            );
            return;
        }
        if (!syncValid) {
            toast.error("כל תקציב סנכרון חייב להיות מספר שלם בטווח המוגדר עבורו");
            return;
        }
        if (!retentionValid) {
            toast.error(
                `כל חלון שמירת נתונים חייב להיות מספר שלם של ימים בין ${RETENTION_MIN_DAYS} ל-${RETENTION_MAX_DAYS.toLocaleString("he-IL")}`,
            );
            return;
        }
        if (!trackingValid) {
            toast.error(
                "כל חלון מעורבות אוטומטית חייב להיות מספר שלם של שניות בטווח המוצג מתחתיו",
            );
            return;
        }
        if (!placementValid) {
            toast.error("כל הגדרה של בדיקת מיקום חייבת להיות מספר שלם בטווח המוצג מתחתיה");
            return;
        }
        if (!authGraceValid) {
            toast.error(
                `תקופת החסד לאימות חייבת להיות מספר שלם של שעות בין ${AUTH_GRACE_MIN_HOURS} ל-${AUTH_GRACE_MAX_HOURS}`,
            );
            return;
        }
        saveMut.mutate({
            invitations: { links_enabled: form.linksEnabled, ttl_hours: ttl },
            access: { allow_invited_signup: form.allowInvitedSignup },
            sync: {
                backfill_days: Number(form.sync.backfillDays),
                backfill_messages: Number(form.sync.backfillMessages),
                daily_messages_per_mailbox: Number(form.sync.dailyPerMailbox),
                daily_messages_per_org: Number(form.sync.dailyPerOrg),
            },
            retention: {
                engagement_event_days: Number(form.retention.engagementDays),
                form_event_days: Number(form.retention.formDays),
                audit_log_days: Number(form.retention.auditDays),
            },
            tracking: {
                machine_window_open_seconds: Number(form.tracking.machineWindowOpen),
                machine_window_click_seconds: Number(form.tracking.machineWindowClick),
                machine_window_probable_seconds: Number(form.tracking.machineWindowProbable),
            },
            deliverability: {
                enforce_domain_auth: form.enforceDomainAuth,
                auth_grace_hours: authGrace,
            },
            placement: {
                tests_per_month_trial: Number(form.placement.testsTrial),
                tests_per_month_paid: Number(form.placement.testsPaid),
                seeds_per_test: Number(form.placement.seedsPerTest),
                spacing_seconds: Number(form.placement.spacingSeconds),
            },
        });
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    נשמר במסד הנתונים ולעולם אינו נקרא ממשתני הסביבה. כל מה שמוגדר ברמת הסביבה
                    מופיע בלשונית סביבה.
                </p>
                <Button
                    size="sm"
                    onClick={save}
                    disabled={!dirty || saveMut.isPending || !form}
                >
                    <Save className="size-4" />
                    {saveMut.isPending ? "שומר..." : "שמירת שינויים"}
                </Button>
            </div>

            {settingsQ.isLoading && (
                <div className="space-y-3">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
            )}

            {settingsQ.isError && (
                <ErrorState
                    error={settingsQ.error}
                    title="לא ניתן לטעון את הגדרות המופע"
                    onRetry={() => settingsQ.refetch()}
                />
            )}

            {form && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>הזמנות</CardTitle>
                            <CardDescription>
                                אופן צירוף אנשים לסביבת עבודה מתוך הגדרות, חברי צוות בלוח
                                הבקרה.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">קישורי הזמנה</p>
                                    <p className="text-xs text-muted-foreground">
                                        הצג קישור להעתקה ליד כל הזמנה ממתינה. השאר הגדרה זו פעילה
                                        כאשר שרת הדואר של המערכת אינו מוסר הודעות, אחרת המוזמן לא
                                        יקבל דבר.
                                    </p>
                                </div>
                                <Switch
                                    checked={form.linksEnabled}
                                    onCheckedChange={(v) =>
                                        setForm({ ...form, linksEnabled: v })
                                    }
                                />
                            </div>

                            <div>
                                <Label htmlFor="ttl-hours">תוקף הזמנה (שעות)</Label>
                                {/* Text, not number: the native spinner is not ours, and the value is already validated as a string. */}
                                <Input
                                    id="ttl-hours"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={form.ttlHours}
                                    onChange={(e) =>
                                        setForm({ ...form, ttlHours: e.target.value })
                                    }
                                    aria-invalid={!ttlValid}
                                    className="mt-1"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    בין {TTL_MIN_HOURS} ל-{TTL_MAX_HOURS} שעות (30 ימים). הזמנות
                                    קיימות שומרות על תוקף התפוגה שאיתו הונפקו.
                                </p>
                                {!ttlValid && (
                                    <p className="mt-1 text-xs text-red-600">
                                        הזן מספר שלם של שעות בין {TTL_MIN_HOURS} ל-
                                        {TTL_MAX_HOURS}.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>גישה</CardTitle>
                            <CardDescription>
                                מי רשאי ליצור חשבון במופע זה. מצב ההרשמה עצמו מנוהל במשתני
                                הסביבה ומופיע תחת{" "}
                                <TabLink onClick={() => onSwitchTab?.("environment")}>
                                    סביבה
                                </TabLink>
                                .
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">אפשר הרשמה למוזמנים</p>
                                    <p className="text-xs text-muted-foreground">
                                        אדם המחזיק בהזמנה בתוקף יכול ליצור חשבון גם כאשר ההרשמה
                                        הפתוחה סגורה. כיבוי אפשרות זו אומר שרק חשבונות קיימים
                                        יכולים להתחבר.
                                    </p>
                                </div>
                                <Switch
                                    checked={form.allowInvitedSignup}
                                    onCheckedChange={(v) =>
                                        setForm({ ...form, allowInvitedSignup: v })
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>שימוש הוגן בסנכרון תיבות דואר</CardTitle>
                            <CardDescription>
                                מה תיבת דואר מחוברת מייבאת וכמה דואר חדש היא רשאית לשמור. דואר
                                מעבר לתקציב ממתין ונקלט עם תחילת החלון הבא; שום הודעה אינה
                                נמחקת, ותשובות להודעות שנשלחו מהתיבה עצמה לעולם אינן מעוכבות.
                                שינויים נכנסים לתוקף בפעם הבאה שתיבת הדואר נטענת לתהליך עבודה
                                (תוך מספר דקות). מספרי הקצב הקבועים מופיעים תחת{" "}
                                <TabLink onClick={() => onSwitchTab?.("limits")}>מגבלות</TabLink>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-3 pt-0 md:grid-cols-2">
                            {SYNC_FIELDS.map((f) => {
                                const valid = syncFieldValid(form.sync[f.key], f.min, f.max);
                                return (
                                    <div key={f.key}>
                                        <Label htmlFor={`sync-${f.key}`}>{f.label}</Label>
                                        <Input
                                            id={`sync-${f.key}`}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={form.sync[f.key]}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    sync: { ...form.sync, [f.key]: e.target.value },
                                                })
                                            }
                                            aria-invalid={!valid}
                                            className="mt-1"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {f.help} בין {f.min.toLocaleString("he-IL")} ל-
                                            {f.max.toLocaleString("he-IL")}.
                                        </p>
                                        {!valid && (
                                            <p className="mt-1 text-xs text-red-600">
                                                הזן מספר שלם בין {f.min.toLocaleString("he-IL")}{" "}
                                                ל-{f.max.toLocaleString("he-IL")}.
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>שמירת נתונים</CardTitle>
                            <CardDescription>
                                למשך כמה זמן נשמרת היסטוריה ברמת אירוע במופע זה. כל חלון למטה
                                קובע גם למשך כמה זמן מוחזקים הנתונים האישיים באותו יומן, כך
                                שאלו ההגדרות שעליהן חלה מדיניות שמירת נתונים או פרטיות. תהליך
                                ניקוי רץ מספר פעמים ביום וקורא ערכים אלו בכל סבב, כך ששינוי
                                נכנס לתוקף ללא הפעלה מחדש. המחיקה היא לצמיתות: קיצור חלון מסיר
                                בסבב הניקוי הבא את מה שכבר חורג ממנו.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">תבניות קבועות</span>
                                {RETENTION_PRESETS.map((preset) => {
                                    const active = RETENTION_FIELDS.every(
                                        (f) => form.retention[f.key] === preset.values[f.key],
                                    );
                                    return (
                                        <Button
                                            key={preset.id}
                                            type="button"
                                            size="sm"
                                            variant={active ? "default" : "outline"}
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    retention: { ...preset.values },
                                                })
                                            }
                                        >
                                            {preset.label}
                                            <span className="ms-1.5 text-[11px] opacity-70">
                                                {preset.description}
                                            </span>
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                {RETENTION_FIELDS.map((f) => {
                                    const valid = syncFieldValid(
                                        form.retention[f.key],
                                        RETENTION_MIN_DAYS,
                                        RETENTION_MAX_DAYS,
                                    );
                                    return (
                                        <div key={f.key}>
                                            <Label htmlFor={`retention-${f.key}`}>{f.label}</Label>
                                            <Input
                                                id={`retention-${f.key}`}
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="off"
                                                value={form.retention[f.key]}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        retention: {
                                                            ...form.retention,
                                                            [f.key]: e.target.value,
                                                        },
                                                    })
                                                }
                                                aria-invalid={!valid}
                                                className="mt-1"
                                            />
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {f.help} בין {RETENTION_MIN_DAYS} ל-
                                                {RETENTION_MAX_DAYS.toLocaleString("he-IL")} ימים.
                                            </p>
                                            {!valid && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    הזן מספר שלם של ימים בין{" "}
                                                    {RETENTION_MIN_DAYS} ל-
                                                    {RETENTION_MAX_DAYS.toLocaleString("he-IL")}.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>מעורבות אוטומטית</CardTitle>
                            <CardDescription>
                                שערי אבטחת דואר מושכים את פיקסל המעקב וסורקים כל קישור כאשר
                                הודעה מגיעה, תוך שימוש בזיהוי דפדפן (User Agent) רגיל. פתיחה או
                                לחיצה המתקבלות בתוך חלונות אלו נרשמות כאוטומטיות: הן עדיין
                                נשמרות כראיית מסירה ומוצגות בציר הזמן, אך אינן נספרות כמעורבות,
                                אינן מפעילות התפצלות או אוטומציה, ואינן שולחות Webhook. שום
                                מידע אינו נזרק בשני המקרים. השעון מתחיל כאשר השליחה נמסרת
                                לתהליך עבודה, כך שהחלון מכסה גם את התור אצל הספק ואת זמן
                                ההעברה לנמען. רשת שעוסקת אך ורק בסינון דואר מזוהה לפי שם ואינה
                                מוגבלת בזמן; רשת שעשויה לשמש גם גולש אנושי מקבלת את חלון הסורק
                                המשוער למטה. שינוי נכנס לתוקף תוך דקה וחל רק על אירועים שנרשמו
                                לאחריו: פתיחות ולחיצות שכבר נשמרו שומרות על הסיווג שניתן להן
                                בעת הגעתן.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-3 pt-0 md:grid-cols-2">
                            {TRACKING_FIELDS.map((f) => {
                                const valid = syncFieldValid(
                                    form.tracking[f.key],
                                    f.min,
                                    f.max,
                                );
                                return (
                                    <div key={f.key}>
                                        <Label htmlFor={`tracking-${f.key}`}>{f.label}</Label>
                                        <Input
                                            id={`tracking-${f.key}`}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={form.tracking[f.key]}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    tracking: {
                                                        ...form.tracking,
                                                        [f.key]: e.target.value,
                                                    },
                                                })
                                            }
                                            aria-invalid={!valid}
                                            className="mt-1"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {f.help} בין {f.min} ל-
                                            {f.max.toLocaleString("he-IL")} שניות.
                                        </p>
                                        {!valid && (
                                            <p className="mt-1 text-xs text-red-600">
                                                הזן מספר שלם בין {f.min} ל-
                                                {f.max.toLocaleString("he-IL")}.
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>בדיקות מיקום בתיבת הדואר</CardTitle>
                            <CardDescription>
                                בדיקת מיקום שולחת עותק אחד של תבנית לכל תיבת בדיקה בפאנל ומדווחת
                                היכן הוא נחת. המכסות החודשיות סופרות בדיקות בפאנל המערכת
                                וב-Warmbly Cloud; בדיקות על תיבות הבדיקה הפרטיות של סביבת עבודה
                                לעולם אינן נספרות, ומופע באירוח עצמי אינו מגביל בדיקות כלל.
                                השוואת מעקב נספרת כשתי בדיקות. תיבות הבדיקה עצמן מנוהלות בעמוד
                                פאנל תיבות בדיקה.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-3 pt-0 md:grid-cols-2">
                            {PLACEMENT_FIELDS.map((f) => {
                                const valid = syncFieldValid(form.placement[f.key], f.min, f.max);
                                return (
                                    <div key={f.key}>
                                        <Label htmlFor={`placement-${f.key}`}>{f.label}</Label>
                                        <Input
                                            id={`placement-${f.key}`}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={form.placement[f.key]}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    placement: {
                                                        ...form.placement,
                                                        [f.key]: e.target.value,
                                                    },
                                                })
                                            }
                                            aria-invalid={!valid}
                                            className="mt-1"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {f.help} בין {f.min.toLocaleString("he-IL")} ל-
                                            {f.max.toLocaleString("he-IL")}.
                                        </p>
                                        {!valid && (
                                            <p className="mt-1 text-xs text-red-600">
                                                הזן מספר שלם בין {f.min.toLocaleString("he-IL")}{" "}
                                                ל-{f.max.toLocaleString("he-IL")}.
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>אימות דומיין שולח</CardTitle>
                            <CardDescription>
                                Gmail,‏ Yahoo ו-Outlook דוחים או מסננים לספאם דואר מדומיין ללא
                                SPF ו-DMARC, ושולח לא מאומת אחד פוגע במוניטין של כל תיבת דואר
                                במאגר החימום המשותף. Warmbly בודקת כל דומיין שולח מדי יום ויכולה
                                לעצור שליחת קמפיינים וחימום מדומיין שממשיך להיכשל. תקופת החסד
                                קובעת למשך כמה זמן דומיין רשאי להיכשל תחילה, כך שתקלת DNS זמנית
                                לא תעצור קמפיינים של לקוח, ובעל החשבון יקבל התראות לאורך כל
                                התקופה.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-0">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-0.5">
                                    <Label>עצור שליחה מדומיינים לא מאומתים</Label>
                                    <p className="text-xs text-muted-foreground">
                                        כאשר האפשרות כבויה, הבדיקה נשארת אינפורמטיבית בלבד:
                                        הדומיינים עדיין נבדקים, מוצגים בתיבת הדואר ומועלים על
                                        ידי יועץ העבירות, אך שום שליחה אינה נחסמת.
                                    </p>
                                </div>
                                <Switch
                                    checked={form.enforceDomainAuth}
                                    onCheckedChange={(v) =>
                                        setForm({ ...form, enforceDomainAuth: v })
                                    }
                                />
                            </div>
                            <div className="md:max-w-sm">
                                <Label htmlFor="auth-grace-hours">תקופת חסד (שעות)</Label>
                                <Input
                                    id="auth-grace-hours"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={form.authGraceHours}
                                    onChange={(e) =>
                                        setForm({ ...form, authGraceHours: e.target.value })
                                    }
                                    aria-invalid={!authGraceValid}
                                    disabled={!form.enforceDomainAuth}
                                    className="mt-1"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    למשך כמה זמן דומיין חייב להמשיך להיכשל לפני שתיבות הדואר
                                    שלו יפסיקו לשלוח. בין {AUTH_GRACE_MIN_HOURS} ל-
                                    {AUTH_GRACE_MAX_HOURS.toLocaleString("he-IL")}.
                                </p>
                                {!authGraceValid && (
                                    <p className="mt-1 text-xs text-red-600">
                                        הזן מספר שלם בין {AUTH_GRACE_MIN_HOURS} ל-
                                        {AUTH_GRACE_MAX_HOURS.toLocaleString("he-IL")}.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {form && dirty && (
                <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" onClick={save} disabled={saveMut.isPending}>
                        <Save className="size-4" />
                        {saveMut.isPending ? "שומר..." : "שמירת שינויים"}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => server && setForm(toForm(server))}
                        disabled={saveMut.isPending}
                    >
                        ביטול שינויים
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        שמירה מתעדת את השינוי ביומן הביקורת של המערכת.
                    </span>
                </div>
            )}
        </div>
    );
}

// An inline link inside descriptive copy that switches tabs instead of leaving the page.
function TabLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="font-medium text-[var(--admin-accent-strong)] hover:underline"
        >
            {children}
        </button>
    );
}
