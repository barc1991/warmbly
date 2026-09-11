// Overview tab — at-a-glance contact 360.
//
// Composition:
//   - Suppression card (only when suppressed)
//   - Engagement: six flat stat tiles with a thin ratio bar where
//     a ratio over Sent makes sense
//   - Latest activity rail
//   - Profile rows for the fields not already in the panel header

import {
    AlertOctagonIcon,
    BanIcon,
    ExternalLinkIcon,
    MailIcon,
    MailOpenIcon,
    MailWarningIcon,
    MousePointerClickIcon,
    ReplyIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import type ContactDetail from "@/lib/api/models/app/contacts/ContactDetail";
import type Contact from "@/lib/api/models/app/contacts/Contact";
import { useConfirm } from "@/hooks/context/confirm";
import { useWriteGuard } from "@/hooks/usePermission";
import { useRemoveSuppression } from "@/lib/api/hooks/app/suppressions/useSuppressions";
import { SOURCE_LABEL } from "@/lib/api/models/app/suppressions/Suppression";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { fmtAbsolute, fmtRelative } from "./format";
import { sourceLabel } from "./ActivityTab";
import { ContactSegmentsSection } from "./ContactSegmentsSection";
import VerificationCard from "./VerificationCard";

export default function OverviewTab({
    contact,
    detail,
    detailLoading,
}: {
    contact: Contact;
    detail?: ContactDetail;
    detailLoading: boolean;
}) {
    const eng = detail?.engagement;
    const supp = detail?.suppression;
    const sent = eng?.total_sent ?? 0;
    const confirm = useConfirm();
    const write = useWriteGuard("MANAGE_CONTACTS");
    const removeSuppression = useRemoveSuppression();

    function askLift() {
        if (!supp) return;
        const own = supp.source === "unsubscribe" || supp.source === "complaint" || supp.source === "bounce";
        const what = supp.kind === "domain" ? `כל הדומיין @${supp.value}` : contact.email;
        const text = own
            ? `${contact.email} ${SOURCE_LABEL[supp.source]?.toLowerCase() ?? "הושתק"}. הסרת הרשומה תאפשר לקמפיינים לשלוח שוב דוא״ל אל ${what}, והפעולה תירשם ביומן הביקורת. להמשיך?`
            : `האם להסיר את ${what} מרשימת ההשתקה? קמפיינים יוכלו לשלוח אליהם דוא״ל שוב.`;
        confirm.show(text, async () => {
            try {
                await removeSuppression.mutateAsync(supp.id);
                toast.success("הוסר מרשימת ההשתקה");
            } catch (err) {
                toast.error(buildError(err as AppError));
            }
        });
    }

    return (
        <div className="space-y-5">
            {supp && (
                <div className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2.5 flex items-start gap-2">
                    <BanIcon className="w-3.5 h-3.5 text-red-600 mt-px shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-red-900 leading-tight">
                            {SOURCE_LABEL[supp.source] ?? "מושתק"}
                            {supp.kind === "domain" ? ` · כל הדומיין @${supp.value}` : ""}
                        </div>
                        <div className="text-[11px] text-red-700/90 mt-0.5">
                            {supp.reason || "לא צוינה סיבה"} · מאז{" "}
                            {fmtAbsolute(supp.created_at)}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => write.guard(askLift)(e)}
                        disabled={removeSuppression.isPending}
                        className="shrink-0 h-6 px-2 rounded-md border border-red-200 bg-white text-[11px] font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        הסר
                    </button>
                </div>
            )}

            <Section title="עבירות מסירה">
                <VerificationCard detail={detail?.verification} loading={detailLoading} />
            </Section>

            <Section title="מעורבות">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    <StatTile
                        icon={<MailIcon className="w-3 h-3" />}
                        label="נשלחו"
                        value={sent}
                        loading={detailLoading}
                    />
                    <StatTile
                        icon={<MailOpenIcon className="w-3 h-3" />}
                        label="נפתחו"
                        value={eng?.total_opened ?? 0}
                        loading={detailLoading}
                        ratioOf={sent}
                    />
                    <StatTile
                        icon={<MousePointerClickIcon className="w-3 h-3" />}
                        label="נלחצו"
                        value={eng?.total_clicked ?? 0}
                        loading={detailLoading}
                        ratioOf={sent}
                    />
                    <StatTile
                        icon={<ReplyIcon className="w-3 h-3" />}
                        label="נענו"
                        value={eng?.total_replied ?? 0}
                        loading={detailLoading}
                        ratioOf={sent}
                        accent={
                            eng && eng.total_replied > 0 ? "positive" : undefined
                        }
                    />
                    <StatTile
                        icon={<MailWarningIcon className="w-3 h-3" />}
                        label="נדחו"
                        value={eng?.total_bounced ?? 0}
                        loading={detailLoading}
                        ratioOf={sent}
                        accent={
                            eng && eng.total_bounced > 0 ? "negative" : undefined
                        }
                    />
                    <StatTile
                        icon={<AlertOctagonIcon className="w-3 h-3" />}
                        label="תלונות"
                        value={eng?.total_complained ?? 0}
                        loading={detailLoading}
                        ratioOf={sent}
                        accent={
                            eng && eng.total_complained > 0
                                ? "negative"
                                : undefined
                        }
                    />
                </div>
            </Section>

            <Section title="פעילות אחרונה">
                <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                    <LatestRow
                        label="שליחה אחרונה"
                        ts={eng?.last_sent_at}
                        icon={<MailIcon className="w-3 h-3" />}
                    />
                    <LatestRow
                        label="פתיחה אחרונה"
                        ts={eng?.last_opened_at}
                        icon={<MailOpenIcon className="w-3 h-3" />}
                    />
                    <LatestRow
                        label="לחיצה אחרונה"
                        ts={eng?.last_clicked_at}
                        icon={<MousePointerClickIcon className="w-3 h-3" />}
                    />
                    <LatestRow
                        label="תשובה אחרונה"
                        ts={eng?.last_replied_at}
                        icon={<ReplyIcon className="w-3 h-3" />}
                    />
                    <LatestRow
                        label="דחייה אחרונה"
                        ts={eng?.last_bounced_at}
                        icon={<MailWarningIcon className="w-3 h-3" />}
                    />
                </div>
            </Section>

            <Section title="פרופיל">
                <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                    <ProfileRow
                        label="חברה"
                        value={contact.company || "—"}
                    />
                    <ProfileRow label="טלפון" value={contact.phone || "—"} />
                    <ProfileRow
                        label="אתר אינטרנט"
                        value={
                            contact.custom_fields?.website ? (
                                <a
                                    href={
                                        contact.custom_fields.website.startsWith("http")
                                            ? contact.custom_fields.website
                                            : `https://${contact.custom_fields.website}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 font-medium truncate max-w-[220px]"
                                >
                                    <span className="truncate">{contact.custom_fields.website.replace(/^https?:\/\//, "")}</span>
                                    <ExternalLinkIcon className="w-3 h-3 shrink-0" />
                                </a>
                            ) : (
                                "—"
                            )
                        }
                    />
                    <ProfileRow
                        label="קטגוריות"
                        value={
                            contact.categories.length > 0 ? (
                                <span className="flex flex-wrap gap-1 justify-end">
                                    {contact.categories.map((c) => (
                                        <span
                                            key={c.id}
                                            className="inline-flex h-4 items-center px-1.5 rounded text-[10.5px] font-medium"
                                            style={{
                                                backgroundColor: `${c.color}1a`,
                                                color: c.color,
                                            }}
                                        >
                                            {c.title}
                                        </span>
                                    ))}
                                </span>
                            ) : (
                                "ללא"
                            )
                        }
                    />
                    <ProfileRow
                        label="קמפיינים"
                        value={
                            contact.campaigns.length > 0
                                ? `${contact.campaigns.length} פעילים`
                                : "ללא"
                        }
                    />
                </div>
            </Section>

            <ContactSegmentsSection contactId={contact.id} />

            {detail && (
                <Section title="מקור">
                    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                        <ProfileRow
                            label="הגיע מ-"
                            value={
                                detail.source_detail
                                    ? `${sourceLabel(detail.source)} · ${detail.source_detail}`
                                    : sourceLabel(detail.source)
                            }
                        />
                        <ProfileRow
                            label="נצפה לראשונה"
                            value={fmtAbsolute(detail.first_seen_at)}
                        />
                    </div>
                </Section>
            )}

            {Object.entries(contact.custom_fields || {}).filter(([k]) => k !== "website").length > 0 && (
                <Section title="שדות מותאמים אישית">
                    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                        {Object.entries(contact.custom_fields)
                            .filter(([k]) => k !== "website")
                            .map(([k, v]) => (
                                <ProfileRow key={k} label={k} value={v} mono />
                            ))}
                    </div>
                </Section>
            )}
        </div>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section>
            <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                {title}
            </h2>
            {children}
        </section>
    );
}

function StatTile({
    icon,
    label,
    value,
    loading,
    ratioOf,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    loading: boolean;
    ratioOf?: number;
    accent?: "positive" | "negative";
}) {
    const pct =
        ratioOf && ratioOf > 0 ? Math.round((value / ratioOf) * 100) : null;
    const valueTone =
        accent === "negative"
            ? "text-red-700"
            : accent === "positive"
              ? "text-emerald-700"
              : "text-slate-900";
    const barTone =
        accent === "negative"
            ? "bg-red-500/80"
            : accent === "positive"
              ? "bg-emerald-500/80"
              : "bg-slate-900/70";

    return (
        <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-medium flex items-center gap-1">
                <span className="text-slate-400">{icon}</span>
                {label}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1.5">
                <span
                    className={`text-[15px] font-semibold tabular-nums leading-none ${valueTone}`}
                >
                    {loading ? (
                        <span className="inline-block w-6 h-3.5 rounded bg-slate-100 animate-pulse align-middle" />
                    ) : (
                        value.toLocaleString()
                    )}
                </span>
                {pct !== null && (
                    <span className="text-[10px] text-slate-400 tabular-nums">
                        {pct}%
                    </span>
                )}
            </div>
            {pct !== null && (
                <div className="mt-1.5 h-0.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className={`h-full ${barTone} transition-all`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function LatestRow({
    label,
    ts,
    icon,
}: {
    label: string;
    ts?: string | null;
    icon: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0 border-slate-100">
            <span className={ts ? "text-slate-500" : "text-slate-300"}>
                {icon}
            </span>
            <div className="text-[11.5px] text-slate-700 flex-1">{label}</div>
            <div
                className={`text-[11.5px] tabular-nums ${
                    ts ? "text-slate-600" : "text-slate-300"
                }`}
            >
                {ts ? fmtRelative(ts) : "אף פעם"}
            </div>
        </div>
    );
}

function ProfileRow({
    label,
    value,
    mono,
}: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="flex items-start gap-2 px-3 py-1.5 border-b last:border-b-0 border-slate-100">
            <div className="text-[11px] text-slate-500 w-24 shrink-0">
                {label}
            </div>
            <div
                className={`text-[12px] flex-1 text-right break-words text-slate-900 ${
                    mono ? "font-mono" : ""
                }`}
            >
                {value}
            </div>
        </div>
    );
}
