// Website tracking settings: the snippet a workspace installs on its own
// site, and the privacy posture it runs under. Off by default, and the
// consent mode, location precision and retention window are all the
// workspace's decision, enforced on the server rather than in the snippet.

import React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Row, Section, SectionShell, Toggle } from "../_components/SectionShell";
import { NoAccess } from "@/components/layout/NoAccess";
import { usePermission } from "@/hooks/usePermission";
import { useConfirm } from "@/hooks/context/confirm";
import SaveStatus from "../_components/SaveStatus";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";
import { NumberInput } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/useAutosave";
import { useRegisterUnsaved } from "@/hooks/context/unsaved";
import {
    useRotateWebsiteTrackingKey,
    useUpdateWebsiteTrackingSettings,
    useWebsiteTrackingSettings,
} from "@/lib/api/hooks/app/websitetracking/useWebsiteTracking";
import {
    WEBSITE_RETENTION_MAX_DAYS,
    WEBSITE_RETENTION_MIN_DAYS,
    trackingSnippet,
    type UpdateWebsiteTrackingSettings,
    type WebsiteTrackingSettings,
} from "@/lib/api/models/app/websitetracking/WebsiteTrackingSettings";

const CONSENT_OPTIONS: SelectOption[] = [
    { value: "explicit", label: "בקש רשות תחילה (מומלץ)" },
    { value: "implicit", label: "הקלט בטעינת העמוד" },
];

const LOCATION_OPTIONS: SelectOption[] = [
    { value: "none", label: "אל תשמור מיקום" },
    { value: "country", label: "מדינה בלבד" },
    { value: "city", label: "מדינה, מחוז ועיר" },
];

type Draft = Pick<
    WebsiteTrackingSettings,
    "enabled" | "consent_mode" | "location_precision" | "retention_days"
> & { hosts: string };

function toDraft(s: WebsiteTrackingSettings): Draft {
    return {
        enabled: s.enabled,
        consent_mode: s.consent_mode,
        location_precision: s.location_precision,
        retention_days: s.retention_days,
        hosts: s.allowed_hosts.join("\n"),
    };
}

function toPatch(d: Draft): UpdateWebsiteTrackingSettings {
    return {
        enabled: d.enabled,
        consent_mode: d.consent_mode,
        location_precision: d.location_precision,
        retention_days: d.retention_days,
        allowed_hosts: d.hosts
            .split(/[\n,]/)
            .map((h) => h.trim())
            .filter(Boolean),
    };
}

export default function WebsiteTrackingSettingsPage() {
    const canManage = usePermission("MANAGE_SETTINGS");
    if (!canManage) return <NoAccess feature="מעקב אתר" permissionLabel="ניהול הגדרות" />;
    return <WebsiteTrackingSettingsView />;
}

function WebsiteTrackingSettingsView() {
    const { data, isLoading } = useWebsiteTrackingSettings();
    const update = useUpdateWebsiteTrackingSettings();
    const rotate = useRotateWebsiteTrackingKey();
    const confirm = useConfirm();
    const [draft, setDraft] = React.useState<Draft | null>(null);

    const autosave = useAutosave({
        value: draft,
        enabled: !!draft,
        debounceMs: 600,
        save: async (v) => {
            if (v) await update.mutateAsync(toPatch(v));
        },
    });
    useRegisterUnsaved(autosave, () => setDraft(autosave.savedValue));

    // One-shot hydration, as on the other autosave settings pages: the server
    // seeds the draft once and the save path owns the baseline after that.
    const hydrated = React.useRef(false);
    React.useEffect(() => {
        if (!data || hydrated.current) return;
        hydrated.current = true;
        const d = toDraft(data);
        setDraft(d);
        autosave.markSaved(d);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const patch = React.useCallback((next: Partial<Draft>) => {
        setDraft((prev) => (prev ? { ...prev, ...next } : prev));
    }, []);

    const hostCount = draft ? toPatch(draft).allowed_hosts?.length ?? 0 : 0;

    return (
        <SectionShell
            title="מעקב אתר"
            description="ראה באילו דפים איש קשר מבקר באתר שלך, ישירות בציר הזמן של הפעילות שלו."
            actions={<SaveStatus status={autosave.status} onRetry={autosave.retry} />}
        >
            <Section
                eyebrow="איסוף נתונים"
                description="שום דבר אינו מוקלט עד שהגדרה זו פעילה. צפיות בעמוד מיוחסות לאיש קשר רק כאשר הוא מגיע מקישור באימייל שנשלח אליו; לא ניתן לייחס מבקר לפי ניחוש."
            >
                {isLoading || !draft ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <Row
                            label="הקלט ביקורים באתר"
                            description={
                                draft.enabled
                                    ? "פעיל. הקוד שלמטה מדווח על צפיות בעמוד עבור סביבת עבודה זו."
                                    : "כבוי. קודים מותקנים אינם שולחים נתונים שנשמרים."
                            }
                        >
                            <Toggle on={draft.enabled} onChange={(on) => patch({ enabled: on })} />
                        </Row>

                        <Row
                            label="הסכמת משתמש (Consent)"
                            description={
                                draft.consent_mode === "explicit"
                                    ? "הקוד אינו שומר ושולח דבר עד שהעמוד קורא ל-warmbly('consent', 'granted'), בדרך כלל מבנר קובצי ה-Cookie שלך."
                                    : "צפיות מוקלטות ברגע שהעמוד נטען. בחר באפשרות זו רק כאשר יש לך בסיס חוקי ללא הסכמה מוקדמת."
                            }
                        >
                            <SelectMenu
                                value={draft.consent_mode}
                                onChange={(v) => patch({ consent_mode: v as Draft["consent_mode"] })}
                                options={CONSENT_OPTIONS}
                                aria-label="הסכמת משתמש"
                                minWidth={220}
                                align="end"
                            />
                        </Row>

                        <Row
                            label="מיקום מכתובת IP"
                            description="מחושב בשרת מכתובת המבקר, שלעולם אינה נשמרת בעצמה."
                        >
                            <SelectMenu
                                value={draft.location_precision}
                                onChange={(v) => patch({ location_precision: v as Draft["location_precision"] })}
                                options={LOCATION_OPTIONS}
                                aria-label="דיוק מיקום"
                                minWidth={220}
                                align="end"
                            />
                        </Row>

                        <Row
                            label="שמור ביקורים למשך"
                            description={`ימים. צפיות ישנות נמחקות אוטומטית (${WEBSITE_RETENTION_MIN_DAYS} עד ${WEBSITE_RETENTION_MAX_DAYS}).`}
                        >
                            <NumberInput
                                min={WEBSITE_RETENTION_MIN_DAYS}
                                max={WEBSITE_RETENTION_MAX_DAYS}
                                value={draft.retention_days}
                                onChange={(n) =>
                                    patch({
                                        retention_days: Number.isFinite(n)
                                            ? Math.min(WEBSITE_RETENTION_MAX_DAYS, Math.max(WEBSITE_RETENTION_MIN_DAYS, n))
                                            : 90,
                                    })
                                }
                                className="w-24"
                            />
                        </Row>

                        <Row
                            label="דומיינים של האתר שלך"
                            description="אחד בכל שורה, לדוגמה example.com. צפיות מדומיינים אחרים יזכו להתעלמות, וקישורים במיילים שלך מזהים מבקר רק כשהם מפנים לאחד מאלה."
                            align="start"
                        >
                            <div className="w-full sm:w-[320px]">
                                <Textarea
                                    value={draft.hosts}
                                    onChange={(e) => patch({ hosts: e.target.value })}
                                    placeholder={"example.com\napp.example.com"}
                                    dir="ltr"
                                    rows={3}
                                    className="text-[12.5px] font-mono text-left"
                                />
                                {draft.enabled && hostCount === 0 && (
                                    <p className="mt-1.5 text-[11.5px] text-amber-700">
                                        הוסף לפחות דומיין אחד, אחרת הביקורים יוקלטו אך לעולם לא יקושרו לאיש קשר.
                                    </p>
                                )}
                            </div>
                        </Row>
                    </>
                )}
            </Section>

            <Section
                eyebrow="התקנה"
                description="הדבק מקטע זה לפני תגית הסגירה </head> בכל עמוד. השורה הראשונה מאפשרת לקרוא ל-warmbly() לפני שהסקריפט נטען."
            >
                {isLoading || !data ? (
                    <div className="h-16 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <Snippet code={trackingSnippet(data)} />
                        {!data.tracking_host && (
                            <p className="text-[11.5px] text-amber-700">
                                בהתקנה זו לא הוגדר דומיין מעקב (TRACKING_DOMAIN), לכן הקוד אינו יכול להיטען. פנה למנהל המערכת.
                            </p>
                        )}
                        <Row
                            label="מפתח אתר (Site key)"
                            description="ציבורי: מציין רק לאיזו סביבת עבודה שייכת הצפייה. החלף אותו אם עותק של הקוד הגיע למקום לא מורשה; המפתח הישן יפסיק לעבוד מיד."
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    confirm.show(
                                        "להחליף את מפתח האתר? יהיה עליך לעדכן את כל הקודים המותקנים למפתח החדש כדי שיחזרו לדווח.",
                                        async () => {
                                            await rotate.mutateAsync();
                                        },
                                    )
                                }
                                className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors"
                            >
                                החלף מפתח
                            </button>
                        </Row>
                    </>
                )}
            </Section>

            <Section
                eyebrow="מה נאסף"
                description="כתובת וכותרת העמוד, מפנה (referrer), פרמטרי UTM, שפה, אזור זמן וגודל מסך מתקבלים מהדפדפן. סוג המכשיר, מערכת ההפעלה והדפדפן נקראים בשרת מהבקשה. מבקרים ששולחים Global Privacy Control או Do Not Track לעולם אינם מוקלטים, וביקורי איש קשר נמחקים יחד עם מחיקת איש הקשר."
            >
                <p className="text-[11.5px] text-slate-500">
                    קרא ל-<code className="font-mono text-slate-700" dir="ltr">warmbly(&apos;consent&apos;, &apos;denied&apos;)</code> כדי
                    לנקות את מזהה המבקר בדפדפן זה, או ל-{" "}
                    <code className="font-mono text-slate-700" dir="ltr">warmbly(&apos;reset&apos;)</code> כאשר מכשיר משותף עובר
                    ידיים.
                </p>
            </Section>
        </SectionShell>
    );
}

function Snippet({ code }: { code: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <div className="relative rounded-md border border-slate-200 bg-slate-50">
            <pre className="overflow-x-auto px-3 py-2.5 rtl:pl-20 ltr:pr-20 text-[11.5px] leading-relaxed font-mono text-slate-700 whitespace-pre" dir="ltr">
                {code}
            </pre>
            <button
                type="button"
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    } catch {
                        /* clipboard blocked */
                    }
                }}
                className="absolute top-1.5 rtl:left-1.5 ltr:right-1.5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 h-7 text-[11.5px] text-slate-600 hover:bg-slate-50"
            >
                {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5" />}
                {copied ? "הועתק" : "העתק"}
            </button>
        </div>
    );
}
