// Customer-facing limit-increase request flow. Lists past requests
// and offers a form to submit a new one. Approval surfaces as the
// effective limit going up on the org; rejection surfaces with the
// admin's notes attached to the row.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";
import { NumberInput } from "@/components/ui/field";
import { Section, SectionShell } from "../_components/SectionShell";
import getCurrentOrganization from "@/lib/api/client/app/organizations/getCurrentOrganization";
import listLimitRequests from "@/lib/api/client/app/organizations/listLimitRequests";
import submitLimitRequest from "@/lib/api/client/app/organizations/submitLimitRequest";
import cancelLimitRequest from "@/lib/api/client/app/organizations/cancelLimitRequest";
import useBrand from "@/hooks/useBrand";
import type {
    LimitField,
    LimitRequestStatus,
} from "@/lib/api/models/app/organizations/LimitIncreaseRequest";

const FIELD_OPTIONS: { value: LimitField; label: string; hint: string }[] = [
    { value: "max_email_accounts", label: "תיבות דואר", hint: "יותר תיבות דואר מחוברות לשליחה" },
    { value: "max_campaigns", label: "קמפיינים (מצטבר)", hint: "מכסה גבוהה יותר לסך כל הקמפיינים שנוצרו" },
    { value: "max_active_campaigns", label: "קמפיינים פעילים", hint: "יותר קמפיינים שפועלים במקביל" },
    { value: "max_team_members", label: "חברי צוות", hint: "יותר מושבים (seats) בסביבת עבודה זו" },
    { value: "max_contacts", label: "אנשי קשר", hint: "שמירת יותר רשומות נמענים" },
    { value: "daily_campaign_limit", label: "שליחות יומיות", hint: "שליחת יותר הודעות קמפיין ביום" },
];

const STATUS_TONE: Record<LimitRequestStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-50 text-slate-600 border-slate-200",
};

const STATUS_LABEL: Record<LimitRequestStatus, string> = {
    pending: "ממתין לבדיקה",
    approved: "אושר",
    rejected: "נדחה",
    cancelled: "בוטל",
};

export default function LimitsSettingsPage() {
    const qc = useQueryClient();
    const brand = useBrand();

    const orgQuery = useQuery({
        queryKey: ["app", "organizations", "current"],
        queryFn: getCurrentOrganization,
    });
    const orgId = orgQuery.data?.id;

    const requestsQuery = useQuery({
        queryKey: ["app", "organizations", orgId, "limit-requests"],
        queryFn: () => listLimitRequests(orgId!),
        enabled: !!orgId,
    });

    const [field, setField] = useState<LimitField>("max_email_accounts");
    const [requested, setRequested] = useState<number>(Number.NaN);
    const [reason, setReason] = useState<string>("");

    const fieldSelectOptions = useMemo<SelectOption[]>(
        () => FIELD_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
        [],
    );

    const submit = useMutation({
        mutationFn: () =>
            submitLimitRequest(orgId!, {
                field,
                requested,
                reason,
            }),
        onSuccess: () => {
            toast.success("הבקשה נשלחה — מנהל מערכת יבדוק אותה בהקדם.");
            qc.invalidateQueries({ queryKey: ["app", "organizations", orgId, "limit-requests"] });
            setRequested(Number.NaN);
            setReason("");
        },
        onError: (err: Error) => {
            toast.error(err.message || "השליחה נכשלה — נסה שוב.");
        },
    });

    const cancel = useMutation({
        mutationFn: (id: string) => cancelLimitRequest(id),
        onSuccess: () => {
            toast.success("הבקשה בוטלה");
            qc.invalidateQueries({ queryKey: ["app", "organizations", orgId, "limit-requests"] });
        },
        onError: (err: Error) => {
            toast.error(err.message || "ביטול הבקשה נכשל");
        },
    });

    const rows = requestsQuery.data?.data ?? [];

    function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        const n = requested;
        if (!Number.isInteger(n) || n <= 0) {
            toast.error("הערך המבוקש חייב להיות מספר שלם חיובי");
            return;
        }
        if (reason.trim().length < 10) {
            toast.error("נא לפרט סיבה (לפחות משפט אחד)");
            return;
        }
        submit.mutate();
    }

    return (
        <SectionShell
            title="מגבלות"
            description="בקש קיבולת גבוהה מזו שהתוכנית שלך או המערכת מאפשרת. הבקשות נבדקות ועשויות להידחות בהתאם לתנאי השירות."
        >
            <Section
                eyebrow="בקש הגדלת מכסה"
                description="ספר לנו מה דרוש לך ומדוע. אנו משתדלים להשיב בתוך יום עסקים אחד."
            >
                <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                        <label className="text-[12px] font-medium text-slate-700">משאב</label>
                        <SelectMenu
                            value={field}
                            onChange={(v) => setField(v as LimitField)}
                            options={fieldSelectOptions}
                            className="mt-1 w-full"
                            aria-label="משאב"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                            {FIELD_OPTIONS.find((o) => o.value === field)?.hint}
                        </p>
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-slate-700">
                            ערך מבוקש
                        </label>
                        <NumberInput
                            min={1}
                            value={requested}
                            onChange={setRequested}
                            className="mt-1 flex w-full"
                            placeholder="לדוגמה 50"
                        />
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-slate-700">סיבה</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            placeholder="מדוע זה חשוב לצוות שלך? נפח שליחה, התחייבויות ללקוחות, תוכניות התרחבות וכו'."
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={submit.isPending || !orgId}
                            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {submit.isPending ? "שולח…" : "שלח בקשה"}
                        </button>
                        <p className="text-[11px] text-slate-500">
                            {brand.terms_url ? (
                                <>
                                    בכפוף לבדיקה בהתאם ל
                                    <a href={brand.terms_url} target="_blank" rel="noreferrer" className="underline mx-1">
                                        תנאי השירות
                                    </a>
                                    שלנו.
                                </>
                            ) : (
                                "בכפוף לבדיקה."
                            )}
                        </p>
                    </div>
                </form>
            </Section>

            <Section eyebrow="הבקשות שלך" description="בקשות בהמתנה, מאושרות והחלטות קודמות.">
                {requestsQuery.isLoading ? (
                    <p className="text-[12px] text-slate-500">טוען…</p>
                ) : rows.length === 0 ? (
                    <p className="text-[12px] text-slate-500">אין בקשות עדיין.</p>
                ) : (
                    <ul className="space-y-2">
                        {rows.map((r) => {
                            const fieldLabel =
                                FIELD_OPTIONS.find((o) => o.value === r.field)?.label ?? r.field;
                            return (
                                <li
                                    key={r.id}
                                    className="rounded-md border border-slate-200 p-3 bg-white"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium">
                                                {fieldLabel}: {r.current_effective.toLocaleString()}
                                                {" ← "}
                                                {r.requested.toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1 break-words">
                                                {new Date(r.submitted_at).toLocaleDateString("he-IL")} · "{r.reason}"
                                            </div>
                                            {r.review_notes && r.status !== "pending" && (
                                                <div className="text-[11px] text-slate-600 mt-1 italic break-words">
                                                    הערת בודק: "{r.review_notes}"
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span
                                                className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_TONE[r.status]}`}
                                            >
                                                {STATUS_LABEL[r.status] ?? r.status}
                                            </span>
                                            {r.status === "pending" && (
                                                <button
                                                    onClick={() => cancel.mutate(r.id)}
                                                    disabled={cancel.isPending}
                                                    className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                                                >
                                                    בטל
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>
        </SectionShell>
    );
}
