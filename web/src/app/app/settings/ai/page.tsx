// AI Settings: unified control center for brand voice, agent tools, and scenario playbooks.
// Replaces the fragmented AI skills and workspace voice settings.

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
    SparklesIcon,
    PlusIcon,
    XIcon,
    Trash2Icon,
    Loader2Icon,
    CheckIcon,
    SearchIcon,
    GlobeIcon,
    DatabaseIcon,
    CalendarIcon,
    PhoneCallIcon,
    UserCheckIcon,
    WrenchIcon,
    BookOpenIcon,
    MessageSquareTextIcon,
    TagIcon,
} from "lucide-react";
import {
    useSkills,
    useCreateSkill,
    useUpdateSkill,
    useDeleteSkill,
} from "@/lib/api/hooks/app/skills/useSkills";
import type { AISkill } from "@/lib/api/models/app/skills/Skill";
import { normalizeError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { usePermission } from "@/hooks/usePermission";
import { useConfirm } from "@/hooks/context/confirm";
import { TextInput } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Toggle, SectionShell, Section, Row, ToggleRow } from "../_components/SectionShell";
import useCurrentOrganization from "@/lib/api/hooks/app/organizations/useCurrentOrganization";
import useUpdateOrganization from "@/lib/api/hooks/app/organizations/useUpdateOrganization";
import AdvisorSettingsSection from "@/components/app/advisor/AdvisorSettingsSection";
import useAiMetered from "@/hooks/useAiMetered";
import { cn } from "@/lib/utils";

type AITab = "voice" | "tools" | "playbooks";

type DraftSkill = { id?: string; name: string; description: string; content: string; enabled: boolean };

const ACTION_TAGS: { label: string; icon: React.ComponentType<{ className?: string }>; snippet: string }[] = [
    {
        label: "קבע משימה לחיוג",
        icon: PhoneCallIcon,
        snippet: "- אם הליד מבקש או מציע שיחת טלפון: צור משימת מעקב לחיוג ב-CRM עם התאריך, השעה ומספר הטלפון שנמסר.\n",
    },
    {
        label: "סנכרן ל-Frappe CRM",
        icon: DatabaseIcon,
        snippet: "- סנכרן את כרטיס הליד ל-Frappe CRM כולל פרטי איש הקשר, טלפון, אתר אינטרנט והערות המחקר.\n",
    },
    {
        label: "תאם פגישה ביומן",
        icon: CalendarIcon,
        snippet: "- אם נקבע מועד לפגישה או שיחה: תאם פגישה וסנכרן אותה ללוח השנה של Frappe CRM עם קישור ופרטי השיחה.\n",
    },
    {
        label: "חפש מידע בגוגל",
        icon: SearchIcon,
        snippet: "- חפש מידע עדכני בגוגל על החברה, תחומי פעילותה ובעלי התפקידים כדי לבסס את המענה.\n",
    },
    {
        label: "סרוק את אתר הליד",
        icon: GlobeIcon,
        snippet: "- גלוש לאתר הליד (עמודי אודות ושירותים) וחלץ ממנו פרטים רלוונטיים לפני ניסוח התשובה.\n",
    },
    {
        label: "השלם פרטי ליד חסרים",
        icon: UserCheckIcon,
        snippet: "- חלץ מחתימת המייל או שורת הסיום את הטלפון, השם המלא, החברה וכתובת האתר, והשלם אותם בכרטיס הליד.\n",
    },
    {
        label: "סווג והוסף תגית לליד",
        icon: TagIcon,
        snippet: "- סווג את הליד לפי תוכן המענה והוסף לו תגית מתאימה (כגון 'מתעניין', 'ליד חם' או 'בקשת שיחה') ושמור בכרטיס איש הקשר.\n",
    },
];

export default function AISettingsPage() {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const canManage = usePermission("MANAGE_SETTINGS");
    const [currentTab, setCurrentTab] = React.useState<AITab>("voice");

    const skills = useSkills();
    const [editing, setEditing] = React.useState<DraftSkill | null>(null);

    // Organization & Voice Profile State
    const orgQuery = useCurrentOrganization();
    const updateOrg = useUpdateOrganization();
    const metered = useAiMetered();

    const [productDesc, setProductDesc] = React.useState("");
    const [icpNotes, setIcpNotes] = React.useState("");
    const [voiceProfile, setVoiceProfile] = React.useState("");
    const [inboxAgent, setInboxAgent] = React.useState(false);
    const [sharedHistory, setSharedHistory] = React.useState(false);

    React.useEffect(() => {
        if (!orgQuery.data) return;
        setProductDesc(orgQuery.data.product_description ?? "");
        setIcpNotes(orgQuery.data.icp_notes ?? "");
        setVoiceProfile(orgQuery.data.voice_profile ?? "");
        setInboxAgent(orgQuery.data.inbox_agent_enabled ?? false);
        setSharedHistory(orgQuery.data.assistant_shared_history ?? false);
    }, [
        orgQuery.data?.product_description,
        orgQuery.data?.icp_notes,
        orgQuery.data?.voice_profile,
        orgQuery.data?.inbox_agent_enabled,
        orgQuery.data?.assistant_shared_history,
    ]);

    const saveVoiceField = (key: "product_description" | "icp_notes" | "voice_profile", value: string, saved: string) => {
        if (value !== saved) {
            updateOrg.mutate(
                { [key]: value },
                {
                    onSuccess: () => toast.success("נשמר בהצלחה"),
                    onError: (err) => toast.error(buildError(normalizeError(err))),
                }
            );
        }
    };

    const onToggleInboxAgent = (next: boolean) => {
        setInboxAgent(next);
        updateOrg.mutate(
            { inbox_agent_enabled: next },
            {
                onError: (err) => {
                    setInboxAgent(!next);
                    toast.error(buildError(normalizeError(err)));
                },
            }
        );
    };

    const onToggleSharedHistory = (next: boolean) => {
        setSharedHistory(next);
        updateOrg.mutate(
            { assistant_shared_history: next },
            {
                onError: (err) => {
                    setSharedHistory(!next);
                    toast.error(buildError(normalizeError(err)));
                },
            }
        );
    };

    const rows = skills.data?.data ?? [];

    const tabs: { id: AITab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { id: "voice", label: isHe ? "קול המותג והנחיות" : "Brand voice & instructions", icon: MessageSquareTextIcon },
        { id: "tools", label: isHe ? "כלי AI ואינטגרציות" : "AI tools & integrations", icon: WrenchIcon },
        { id: "playbooks", label: isHe ? "תרחישים וספרי מענה" : "Scenarios & playbooks", icon: BookOpenIcon },
    ];

    return (
        <SectionShell
            title={isHe ? "בינה מלאכותית" : "Artificial Intelligence"}
            description={
                isHe
                    ? "ניהול קול המותג, הנחיות הפעולה, כלי האוטומציה ותרחישי המענה של סוכן ה-AI בסביבת העבודה."
                    : "Manage your brand voice, instructions, AI tools, and scenario playbooks in your workspace."
            }
            actions={
                currentTab === "playbooks" && canManage ? (
                    <button
                        type="button"
                        onClick={() => setEditing({ name: "", description: "", content: "", enabled: true })}
                        className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                    >
                        <PlusIcon className="w-3 h-3" />
                        {isHe ? "תרחיש חדש" : "New scenario"}
                    </button>
                ) : undefined
            }
        >
            {/* Clean Tab Bar */}
            <div className="px-4 py-3 md:px-8 border-b border-slate-200/70 bg-slate-50/40">
                <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-md bg-slate-200/60 text-[12px] font-medium">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = currentTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setCurrentTab(tab.id)}
                                className={cn(
                                    "h-7 px-3 rounded inline-flex items-center gap-1.5 transition-colors",
                                    active
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                                )}
                            >
                                <Icon className={cn("w-3.5 h-3.5", active ? "text-sky-600" : "text-slate-400")} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* TAB 1: Brand Voice & Agent Settings */}
            {currentTab === "voice" && (
                <>
                    <Section
                        eyebrow={isHe ? "פרופיל קול המותג (Brand Voice)" : "Brand Voice Profile"}
                        description={
                            isHe
                                ? "מנחה את כל ניסוחי הבינה המלאכותית (עוזר, טיוטות מענה, פתיחי מחקר) כך שיישמעו כמוך ויכירו את המוצר והשירותים שלך."
                                : "Grounds every AI writing surface (assistant, reply drafts, research hooks) to match your voice and knowledge."
                        }
                    >
                        <Row
                            label={isHe ? "מה אתה מוכר" : "What you sell"}
                            description={
                                isHe
                                    ? "פירוט מלא על המוצר, השירותים והערך שאתה מספק (ללא הגבלת תווים)."
                                    : "Full description of your product, services, and core value proposition."
                            }
                            align="start"
                        >
                            <Textarea
                                value={productDesc}
                                onChange={(e) => setProductDesc(e.target.value)}
                                onBlur={() => saveVoiceField("product_description", productDesc, orgQuery.data?.product_description ?? "")}
                                disabled={!canManage}
                                rows={4}
                                placeholder={isHe ? "אנחנו עוזרים לצוותי מכירות לשמור על CRM נקי על ידי..." : "We help sales teams keep CRM clean..."}
                                className="w-full max-w-[640px] text-[12.5px]"
                            />
                        </Row>
                        <Row
                            label={isHe ? "למי אתה מוכר" : "Who you sell to"}
                            description={
                                isHe
                                    ? "פרופיל הלקוח האידיאלי (ICP): תפקידים, ענף, גודל חברות והכאבים שהם חווים."
                                    : "Ideal customer profile (ICP): titles, industry, company size, and pain points."
                            }
                            align="start"
                        >
                            <Textarea
                                value={icpNotes}
                                onChange={(e) => setIcpNotes(e.target.value)}
                                onBlur={() => saveVoiceField("icp_notes", icpNotes, orgQuery.data?.icp_notes ?? "")}
                                disabled={!canManage}
                                rows={4}
                                placeholder={isHe ? "מנהלי מכירות בחברות SaaS B2B של 50-500 עובדים ש..." : "VPs of Sales in B2B SaaS companies with 50-500 employees..."}
                                className="w-full max-w-[640px] text-[12.5px]"
                            />
                        </Row>
                        <Row
                            label={isHe ? "טון דיבור וסגנון" : "Tone and style"}
                            description={
                                isHe
                                    ? "איך אתה רוצה להישמע: הנחיות סגנון, אישיות, ביטויים מומלצים או להימנעות, חוקים ספציפיים."
                                    : "How you want to sound: style guidelines, personality, words to use or avoid."
                            }
                            align="start"
                        >
                            <Textarea
                                value={voiceProfile}
                                onChange={(e) => setVoiceProfile(e.target.value)}
                                onBlur={() => saveVoiceField("voice_profile", voiceProfile, orgQuery.data?.voice_profile ?? "")}
                                disabled={!canManage}
                                rows={5}
                                placeholder={isHe ? "ישיר וחם, שאל שאלות קצרות, הימנע מביטויי שיווק קלישאתיים, הצע תמיד ערך מוחשי לפני קריאה לפעולה." : "Direct and warm, short questions, avoid buzzwords..."}
                                className="w-full max-w-[640px] text-[12.5px]"
                            />
                        </Row>
                    </Section>

                    <Section
                        eyebrow={isHe ? "סוכן תיבת דואר (Inbox Agent)" : "Inbox Agent"}
                        description={
                            isHe
                                ? `בעת קבלת מענה אנושי נכנס, מנסח טיוטת תגובה בקול שלך וממתין לאישורך בתיבה המאוחדת. לעולם אינו שולח בעצמו.${metered ? " כל מענה שמטופל עולה 5 נקודות זכות AI." : ""}`
                                : "Drafts replies to human responses in your voice awaiting approval in the unibox."
                        }
                    >
                        <ToggleRow
                            label={isHe ? "נסח מענה עבורי" : "Draft replies for me"}
                            description={
                                isHe
                                    ? "כאשר מישהו משיב, הסוכן כותב טיוטת תגובה ומצרף אותה לשרשור תחת 'טיוטות סוכן'. אתה מאשר ושולח, עורך או מבטל אותה."
                                    : "When someone replies, the agent writes a draft awaiting review."
                            }
                            checked={inboxAgent}
                            onChange={onToggleInboxAgent}
                            disabled={!canManage}
                        />
                    </Section>

                    <Section
                        eyebrow={isHe ? "עוזר בינה מלאכותית" : "AI Assistant"}
                        description={isHe ? "כיצד היסטוריית השיחות של העוזר פועלת בקרב הצוות." : "How assistant conversation history is shared across team members."}
                    >
                        <ToggleRow
                            label={isHe ? "היסטוריה משותפת" : "Shared history"}
                            description={
                                isHe
                                    ? "כל חבר בעל הרשאת 'שימוש ב-AI' יוכל לראות ולהמשיך כל שיחת עוזר בסביבת עבודה זו, במקום רק את שלו."
                                    : "Any member with AI permission can see and continue any assistant session in this workspace."
                            }
                            checked={sharedHistory}
                            onChange={onToggleSharedHistory}
                            disabled={!canManage}
                        />
                    </Section>

                    <AdvisorSettingsSection canManage={canManage} />
                </>
            )}

            {/* TAB 2: AI Tools & Capabilities */}
            {currentTab === "tools" && (
                <Section
                    eyebrow={isHe ? "כלי סוכן ואוטומציות (Tool Calling)" : "Agent Tools & Capabilities"}
                    description={
                        isHe
                            ? "היכולות והאינטגרציות שה-AI מוסמך להפעיל אוטומטית בזמן חקירת לידים, ניסוח מענה וסנכרון נתונים."
                            : "Tools and integrations the AI is authorized to invoke during research, drafting, and data sync."
                    }
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                        {/* Google Serper */}
                        <div className="p-3.5 rounded-md border border-slate-200 bg-white flex flex-col justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded bg-sky-50 text-sky-600 shrink-0 mt-0.5">
                                    <SearchIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-semibold text-slate-900 leading-tight">
                                        {isHe ? "חיפוש Google בזמן אמת (Serper)" : "Google Search (Serper)"}
                                    </h4>
                                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                                        {isHe
                                            ? "חקירת חברות, מתחרים ובעלי תפקידים ישירות מתוצאות החיפוש ומודעות Google. מגובה במטמון של 7 ימים."
                                            : "Real-time research on businesses, competitors, and executives via Google results."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                    <CheckIcon className="w-3 h-3" />
                                    {isHe ? "מופעל (קריאה)" : "Active (Read)"}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">serper_google_search</span>
                            </div>
                        </div>

                        {/* URL Crawl */}
                        <div className="p-3.5 rounded-md border border-slate-200 bg-white flex flex-col justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded bg-sky-50 text-sky-600 shrink-0 mt-0.5">
                                    <GlobeIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-semibold text-slate-900 leading-tight">
                                        {isHe ? "סריקת אתרי לקוחות" : "Website Content Crawler"}
                                    </h4>
                                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                                        {isHe
                                            ? "סריקה וקריאה מאובטחת של עמוד ראשי, אודות, צור קשר ושירותים באתר הליד לביסוס המענה והצעת הערך."
                                            : "Safe HTTP crawler for homepage, about, and services pages to extract business context."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                    <CheckIcon className="w-3 h-3" />
                                    {isHe ? "מופעל (קריאה)" : "Active (Read)"}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">fetch_url_content</span>
                            </div>
                        </div>

                        {/* Contact Field Backfill */}
                        <div className="p-3.5 rounded-md border border-slate-200 bg-white flex flex-col justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded bg-sky-50 text-sky-600 shrink-0 mt-0.5">
                                    <UserCheckIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-semibold text-slate-900 leading-tight">
                                        {isHe ? "השלמת שדות חסרים בכרטיס הליד" : "Contact Lead Enrichment"}
                                    </h4>
                                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                                        {isHe
                                            ? "חילוץ אוטומטי של שם, טלפון, חברה וכתובת אתר מחתימת המייל (במיוחד מ-Gmail) ושמירה ישירה לכרטיס."
                                            : "Automatic signature extraction for phone, website, company, and full name (especially Gmail)."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                                    <CheckIcon className="w-3 h-3" />
                                    {isHe ? "מופעל (כתיבה בטוחה)" : "Active (Safe Write)"}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">update_lead_fields</span>
                            </div>
                        </div>

                        {/* Frappe CRM */}
                        <div className="p-3.5 rounded-md border border-slate-200 bg-white flex flex-col justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded bg-sky-50 text-sky-600 shrink-0 mt-0.5">
                                    <DatabaseIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-semibold text-slate-900 leading-tight">
                                        {isHe ? "סנכרון ולוקאפ מול Frappe CRM" : "Frappe CRM Sync & Lookup"}
                                    </h4>
                                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                                        {isHe
                                            ? "בדיקת כפילויות לפי אימייל, קריאת נתונים, עדכון/יצירת CRM Lead, תיוג Do Not Contact ושמירת מזהה ה-CRM."
                                            : "Email-based deduplication, lead lookup, status read, upsert, and DNC suppression in Frappe."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                                    <CheckIcon className="w-3 h-3" />
                                    {isHe ? "מופעל (דו-כיווני)" : "Active (Two-Way)"}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">frappe_crm_sync / lookup</span>
                            </div>
                        </div>

                        {/* Frappe Calendar Sync */}
                        <div className="p-3.5 rounded-md border border-slate-200 bg-white flex flex-col justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded bg-sky-50 text-sky-600 shrink-0 mt-0.5">
                                    <CalendarIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-semibold text-slate-900 leading-tight">
                                        {isHe ? "סנכרון לוח שנה ויומן Frappe CRM" : "Frappe CRM Calendar Sync"}
                                    </h4>
                                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                                        {isHe
                                            ? "סנכרון פגישות ושיחות ישירות ללוח השנה של Frappe CRM (Doctype Event) עם שעת התחלה, סיום וקישור לשיחה."
                                            : "Automatic event synchronization to Frappe CRM calendar for booked meetings and calls."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                                    <CheckIcon className="w-3 h-3" />
                                    {isHe ? "מופעל (יומן)" : "Active (Calendar)"}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">create_meeting</span>
                            </div>
                        </div>

                        {/* Tasks & Followups */}
                        <div className="p-3.5 rounded-md border border-slate-200 bg-white flex flex-col justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded bg-sky-50 text-sky-600 shrink-0 mt-0.5">
                                    <PhoneCallIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-semibold text-slate-900 leading-tight">
                                        {isHe ? "משימות מעקב וחיוג טלפוני" : "Call Follow-up Tasks"}
                                    </h4>
                                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                                        {isHe
                                            ? "יצירת משימות חיוג ומעקבים ב-Warmbly CRM וב-Frappe CRM כשליד מציע או מבקש שיחת טלפון."
                                            : "Automated task creation for phone calls and SDR follow-ups in Warmbly and Frappe CRM."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                                    <CheckIcon className="w-3 h-3" />
                                    {isHe ? "מופעל (משימות)" : "Active (Tasks)"}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">create_task</span>
                            </div>
                        </div>

                        {/* Lead Tagging & Classification */}
                        <div className="p-3.5 rounded-md border border-slate-200 bg-white flex flex-col justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded bg-sky-50 text-sky-600 shrink-0 mt-0.5">
                                    <TagIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-semibold text-slate-900 leading-tight">
                                        {isHe ? "סיווג, תיוג וסטטוס לידים" : "Lead Tagging & Classification"}
                                    </h4>
                                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                                        {isHe
                                            ? "סיווג אוטומטי של כוונת הליד ('מתעניין', 'ליד חם', 'פגישה נקבעה'), הדבקת תגיות ישירות לכרטיס ועדכון סטטוס מול ה-CRM."
                                            : "Automatic intent classification, direct contact tagging ('Interested', 'Hot Lead'), and status sync."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                                    <CheckIcon className="w-3 h-3" />
                                    {isHe ? "מופעל (סיווג ותיוג)" : "Active (Tagging)"}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400">add_tag / update_lead_fields</span>
                            </div>
                        </div>
                    </div>
                </Section>
            )}

            {/* TAB 3: Scenarios & Playbooks */}
            {currentTab === "playbooks" && (
                <Section
                    eyebrow={isHe ? "תרחישים וספרי מענה (Playbooks)" : "Scenarios & Playbooks"}
                    description={
                        isHe
                            ? "הנחיות התנהגות מפורטות למצבים מוגדרים: טיפול בהתנגדויות מחיר, בקשות לשיחה, פניות מ-Gmail ועוד. ה-AI טוען את התרחיש המתאים בעת הצורך."
                            : "Detailed behavioral playbooks for specific scenarios: objections, call requests, and specific objections."
                    }
                >
                    {skills.isPending ? (
                        <div className="h-16 rounded bg-slate-100 animate-pulse" />
                    ) : rows.length === 0 ? (
                        <p className="text-[12px] text-slate-500 leading-relaxed">
                            {isHe
                                ? "אין עדיין תרחישים מוגדרים. הוסף תרחיש כדי להדריך את ה-AI כיצד להגיב לסיטואציות ספציפיות."
                                : "No playbooks yet. Add one to guide the AI for specific situations."}
                        </p>
                    ) : (
                        <div className="rounded-md border border-slate-200 overflow-hidden divide-y divide-slate-100">
                            {rows.map((s) => (
                                <SkillRow key={s.id} skill={s} onOpen={() => canManage && setEditing({ ...s })} />
                            ))}
                        </div>
                    )}
                </Section>
            )}

            <SkillDrawer draft={editing} onClose={() => setEditing(null)} />
        </SectionShell>
    );
}

function SkillRow({ skill, onOpen }: { skill: AISkill; onOpen: () => void }) {
    const update = useUpdateSkill();
    const isUpdating = update.isPending;

    return (
        <div
            onClick={onOpen}
            className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70 cursor-pointer transition-colors"
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-slate-900 truncate">{skill.name}</span>
                    <span
                        className={cn(
                            "inline-flex items-center px-1.5 py-0.2 text-[10.5px] rounded font-medium",
                            skill.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}
                    >
                        {skill.enabled ? "פעיל" : "מושהה"}
                    </span>
                </div>
                {skill.description && (
                    <p className="text-[11.5px] text-slate-500 mt-0.5 truncate">{skill.description}</p>
                )}
            </div>
            <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Toggle
                    on={skill.enabled}
                    onChange={(next) =>
                        update.mutate(
                            { id: skill.id, data: { enabled: next } },
                            {
                                onError: (err) => toast.error(buildError(normalizeError(err))),
                            }
                        )
                    }
                    disabled={isUpdating}
                />
            </div>
        </div>
    );
}

function SkillDrawer({ draft, onClose }: { draft: DraftSkill | null; onClose: () => void }) {
    const isNew = !draft?.id;
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [content, setContent] = React.useState("");
    const [enabled, setEnabled] = React.useState(true);

    const create = useCreateSkill();
    const update = useUpdateSkill();
    const remove = useDeleteSkill();
    const confirm = useConfirm();

    React.useEffect(() => {
        if (draft) {
            setName(draft.name);
            setDescription(draft.description);
            setContent(draft.content);
            setEnabled(draft.enabled);
        }
    }, [draft]);

    React.useEffect(() => {
        if (!draft) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [draft, onClose]);

    if (!draft) return null;

    const isSaving = create.isPending || update.isPending;
    const canSave = name.trim().length > 0 && !isSaving;

    const handleSave = async () => {
        if (!canSave) return;
        try {
            if (isNew) {
                await create.mutateAsync({ name: name.trim(), description: description.trim(), content, enabled });
                toast.success("התרחיש נוצר בהצלחה");
            } else if (draft.id) {
                await update.mutateAsync({ id: draft.id, data: { name: name.trim(), description: description.trim(), content, enabled } });
                toast.success("התרחיש עודכן בהצלחה");
            }
            onClose();
        } catch (err) {
            toast.error(buildError(normalizeError(err)));
        }
    };

    const handleDelete = () => {
        if (!draft.id) return;
        confirm.show("האם אתה בטוח שברצונך למחוק תרחיש זה?", async () => {
            try {
                await remove.mutateAsync(draft.id!);
                toast.success("התרחיש נמחק");
                onClose();
            } catch (err) {
                toast.error(buildError(normalizeError(err)));
            }
        });
    };

    const insertTagSnippet = (snippet: string) => {
        setContent((prev) => (prev ? `${prev.trim()}\n${snippet}` : snippet));
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex justify-end bg-slate-900/30 backdrop-blur-[2px]">
                <div className="absolute inset-0" onClick={onClose} />
                <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 280 }}
                    className="relative w-full max-w-[620px] bg-white h-full shadow-2xl flex flex-col z-10"
                >
                    {/* Drawer Header */}
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-sky-600" />
                            <h3 className="text-[14px] font-semibold text-slate-900">
                                {isNew ? "תרחיש מענה חדש" : "עריכת תרחיש"}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Drawer Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        <div>
                            <label className="block text-[12px] font-medium text-slate-700 mb-1">
                                שם התרחיש
                            </label>
                            <TextInput
                                value={name}
                                onChange={setName}
                                placeholder="למשל: טיפול בהתנגדות מחיר, בקשה לשיחה"
                                className="w-full text-[12.5px]"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-medium text-slate-700 mb-1">
                                מתי להשתמש (הסבר קצר ל-AI)
                            </label>
                            <TextInput
                                value={description}
                                onChange={setDescription}
                                placeholder="למשל: כאשר הליד מציין שהמחיר יקר או מבקש הנחה"
                                className="w-full text-[12.5px]"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200/80">
                            <div>
                                <span className="text-[12.5px] font-medium text-slate-800 block">תרחיש פעיל</span>
                                <span className="text-[11px] text-slate-500">
                                    כאשר פעיל, ה-AI מתחשב בהנחיות אלו בעת ניסוח מענה.
                                </span>
                            </div>
                            <Toggle on={enabled} onChange={setEnabled} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[12px] font-medium text-slate-700">
                                    ספר הפעלה והנחיות (Markdown)
                                </label>
                            </div>

                            {/* Clean Action Tags (No Emojis!) */}
                            <div className="mb-2 p-2 rounded-md bg-slate-50 border border-slate-200/70">
                                <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                                    הוספת הנחיית פעולה מהירה בלחיצה:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {ACTION_TAGS.map((tag) => {
                                        const Icon = tag.icon;
                                        return (
                                            <button
                                                key={tag.label}
                                                type="button"
                                                onClick={() => insertTagSnippet(tag.snippet)}
                                                className="h-6 px-2 rounded border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                                            >
                                                <Icon className="w-3 h-3 text-sky-600 shrink-0" />
                                                <span>{tag.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={10}
                                placeholder="פרט כיצד ה-AI צריך לפעול במצב זה, מה להציע ומה להימנע..."
                                className="w-full text-[12px] font-mono leading-relaxed"
                            />
                        </div>
                    </div>

                    {/* Drawer Footer */}
                    <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
                        {!isNew ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="h-7 px-2.5 rounded text-red-600 hover:bg-red-50 text-[12px] font-medium inline-flex items-center gap-1 transition-colors"
                            >
                                <Trash2Icon className="w-3.5 h-3.5" />
                                <span>מחק</span>
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-7 px-3 rounded text-slate-600 hover:bg-slate-100 text-[12px] font-medium transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!canSave}
                                className="h-7 px-3.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                            >
                                {isSaving && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                                <span>שמור תרחיש</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
