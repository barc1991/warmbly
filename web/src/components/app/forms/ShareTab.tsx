// ShareTab — hosted link and embed snippets on the left; campaign merge tag
// and per-contact personalized links on the right.

import React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import toast from "react-hot-toast";

import { SearchInput } from "@/components/ui/field";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { getFormContactLink } from "@/lib/api/client/app/forms";
import type { AppError } from "@/lib/api/client/normalizeError";
import useSearchContacts from "@/lib/api/hooks/app/contacts/useSearchContacts";
import type Contact from "@/lib/api/models/app/contacts/Contact";
import type Form from "@/lib/api/models/app/forms/Form";
import buildError from "@/lib/helper/buildError";
import { buildFormLinkToken } from "@/lib/templateVars";

import FormsDomainCard from "./FormsDomainCard";
import Section from "./SettingsSection";

function Snippet({ label, hint, code }: { label?: string; hint?: string; code: string }) {
    const [copied, setCopied] = React.useState(false);
    async function copy() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    return (
        <div>
            {(label || hint) && (
                <div className="flex items-baseline gap-2 mb-1">
                    {label && <span className="text-[12.5px] font-medium text-slate-900">{label}</span>}
                    {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
                </div>
            )}
            <div className="relative">
                <pre className="rounded-md border border-slate-200 bg-slate-50 p-3 pe-16 text-[11.5px] leading-relaxed text-slate-700 overflow-x-auto whitespace-pre-wrap break-all dir-ltr text-start">
                    {code}
                </pre>
                <button
                    type="button"
                    onClick={() => void copy()}
                    className="absolute top-2 end-2 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 hover:bg-slate-50"
                >
                    {copied ? <CheckIcon className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3" />}
                    {copied ? "הועתק" : "העתק"}
                </button>
            </div>
        </div>
    );
}

function contactName(c: Contact): string {
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
}

function ContactLinkRow({ form, contact }: { form: Form; contact: Contact }) {
    const [state, setState] = React.useState<"idle" | "loading" | "copied">("idle");
    const name = contactName(contact);

    async function copyLink() {
        setState("loading");
        try {
            const res = await getFormContactLink(form.id, contact.id);
            await navigator.clipboard.writeText(res.url);
            setState("copied");
            setTimeout(() => setState("idle"), 1500);
        } catch (err) {
            setState("idle");
            toast.error(buildError(err as AppError));
        }
    }

    return (
        <div className="h-9 px-2 flex items-center gap-2 rounded-md hover:bg-slate-50">
            <div className="flex-1 min-w-0 leading-tight">
                <div className="text-[12px] text-slate-900 truncate">{name}</div>
                {name !== contact.email && <div className="text-[10.5px] text-slate-500 truncate">{contact.email}</div>}
            </div>
            <button
                type="button"
                onClick={() => void copyLink()}
                disabled={state === "loading"}
                className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
                {state === "copied" ? <CheckIcon className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3" />}
                {state === "copied" ? "הועתק" : state === "loading" ? "מעתיק…" : "העתק קישור"}
            </button>
        </div>
    );
}

function PersonalizedLinksCard({ form }: { form: Form }) {
    const [query, setQuery] = React.useState("");
    const debouncedQuery = useDebouncedValue(query);
    const active = debouncedQuery.trim().length >= 2;

    const search = useSearchContacts({
        options: {
            query: debouncedQuery.trim(),
            custom_field_filters: [],
            campaign_ids: [],
            sort_by: "updated_at",
            reverse: false,
        },
        limit: 6,
        enabled: active,
        keepPrevious: true,
    });
    const contacts = search.contacts ?? [];

    if (form.status !== "published") {
        return (
            <p className="text-[11.5px] text-slate-500 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                קישורים מותאמים אישית הופכים לפעילים כאשר הטופס מפורסם. פרסם את הטופס, ואז חזור לכאן כדי לקחת את תגית הקמפיין או להעתיק קישור אישי.
            </p>
        );
    }

    return (
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
            <Snippet
                label="שימוש באימייל של קמפיין"
                hint="כל נמען מקבל קישור ייחודי משלו בעת השליחה"
                code={buildFormLinkToken(form.public_id)}
            />

            <div>
                <div className="text-[12.5px] font-medium text-slate-900 mb-1">העתק קישור עבור איש קשר ספציפי</div>
                <SearchInput value={query} onChange={setQuery} placeholder="חפש אנשי קשר לפי שם או אימייל…" />
                {active && (
                    <div className="mt-1.5 flex flex-col">
                        {contacts.map((c) => (
                            <ContactLinkRow key={c.id} form={form} contact={c} />
                        ))}
                        {contacts.length === 0 && !search.isFetching && (
                            <p className="text-[11.5px] text-slate-500 px-2 py-1.5">לא נמצאו אנשי קשר התואמים ל-"{debouncedQuery.trim()}".</p>
                        )}
                        {contacts.length === 0 && search.isFetching && (
                            <p className="text-[11.5px] text-slate-400 px-2 py-1.5">מחפש…</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ShareTab({ form, baseUrl }: { form: Form; baseUrl: string }) {
    const pageUrl = form.share_url || (baseUrl ? `${baseUrl}/f/${form.public_id}` : "");
    const scriptOrigin = React.useMemo(() => {
        try {
            return new URL(pageUrl).origin;
        } catch {
            return baseUrl;
        }
    }, [pageUrl, baseUrl]);
    const scriptUrl = scriptOrigin ? `${scriptOrigin}/forms.js` : "";

    if (!pageUrl) {
        return (
            <div className="p-6 text-[12.5px] text-slate-500">
                לא הוגדרה כתובת URL ציבורית עבור מופע זה. הגדר API_PUBLIC_URL (או FORMS_DOMAIN) בשרת.
            </div>
        );
    }

    return (
        <div className="px-4 lg:px-6 py-5">
            {form.status !== "published" && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    טופס זה עדיין אינו מפורסם. הקישור וההטמעות למטה יהפכו לפעילים ברגע הפרסום.
                </div>
            )}

            <div className="divide-y divide-slate-200/60">
                <Section title="קישור ישיר" description="עמוד הטופס העצמאי. שתף אותו בכל מקום, ללא צורך באתר אינטרנט.">
                    <div className="col-span-full max-w-3xl">
                        <Snippet code={pageUrl} />
                    </div>
                </Section>

                <Section
                    title="הטמעה באתר שלך"
                    description="עובד בוורדפרס, Webflow, שופיפיי, Framer ובכל אתר התומך ב-HTML מותאם אישית."
                >
                    <Snippet
                        label="הטמעת JavaScript"
                        hint="מומלץ, התאמת גודל אוטומטית"
                        code={`<script src="${scriptUrl}" async></script>\n<div data-warmbly-form="${form.public_id}"></div>`}
                    />
                    <Snippet
                        label="חלון קופץ (Popup)"
                        hint="נפתח בשכבה עליונה"
                        code={`<script src="${scriptUrl}" async></script>\n<button data-warmbly-popup="${form.public_id}">התחל עכשיו</button>`}
                    />
                    <Snippet
                        label="iframe רגיל"
                        hint="עבור מערכות המסירות סקריפטים"
                        code={`<iframe src="${pageUrl}?embed=1" width="100%" height="600" style="border:0" title="${form.name.replace(/"/g, "&quot;")}"></iframe>`}
                    />
                    <p className="col-span-full text-[11.5px] text-slate-500">
                        {form.allowed_domains.length > 0
                            ? `ההטמעה מוגבלת לדומיינים: ${form.allowed_domains.join(", ")}.`
                            : "הגבל אילו אתרים רשאים להטמיע טופס זה בלשונית ההגדרות."}
                    </p>
                </Section>

                <Section
                    title="קישורים מותאמים אישית"
                    description="כל איש קשר מקבל קישור ייחודי משלו. פתיחתו ממלאת מראש את הטופס ומקשרת את ההגשה וכל צפייה בעמוד אל איש הקשר והקמפיין ששלח אותו."
                >
                    <div className="col-span-full">
                        <PersonalizedLinksCard form={form} />
                    </div>
                </Section>

                <Section
                    title="דומיין מותאם אישית"
                    description="קישורי טפסים נשלחים כברירת מחדל בשרת משותף. הפנה תת-דומיין של הדומיין שממנו אתה שולח אליו, וכל קישור, כולל הקישורים המותאמים אישית באימיילים, יישא את שמך."
                >
                    <div className="col-span-full">
                        <FormsDomainCard />
                    </div>
                </Section>
            </div>
        </div>
    );
}
