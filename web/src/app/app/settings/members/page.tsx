// Members — invitation flow + roster with inline role change.
//
// Restructured to the flat Section + Row shape so the page reads as
// a single document, not a stack of cards. The role pill on each row
// is clickable (for the owner): pops a picker, PATCH /organization/
// members/:id with the new role, and the matrix at /app/settings/
// roles re-renders accordingly.

import React from "react";
import {
    CheckIcon,
    CopyIcon,
    Loader2Icon,
    MailIcon,
    SendIcon,
    ShieldCheckIcon,
    TrashIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Label } from "@/components/ui/field";
import { useConfirm } from "@/hooks/context/confirm";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import useMembers from "@/lib/api/hooks/app/organizations/useMembers";
import usePendingInvitations from "@/lib/api/hooks/app/organizations/usePendingInvitations";
import useInviteMember from "@/lib/api/hooks/app/organizations/useInviteMember";
import useRemoveMember from "@/lib/api/hooks/app/organizations/useRemoveMember";
import useCancelInvitation from "@/lib/api/hooks/app/organizations/useCancelInvitation";
import useUpdateMemberRole from "@/lib/api/hooks/app/organizations/useUpdateMemberRole";
import useRoles from "@/lib/api/hooks/app/organizations/useRoles";
import useAuthConfig from "@/lib/api/hooks/auth/useAuthConfig";
import type OrganizationRole from "@/lib/api/models/app/organizations/OrganizationRole";
import { useAppStore } from "@/stores";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import getInvitationLink from "@/lib/api/client/app/organizations/getInvitationLink";
import RoleMultiSelect, { RoleChips } from "../_components/RoleMultiSelect";
import {
    RolePill,
    Section,
    SectionShell,
    TableSurface,
    initials,
    safeEmail,
} from "../_components/SectionShell";

function isValidEmail(s: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function MembersSettingsPage() {
    const confirm = useConfirm();
    const access = useFeatureAccess();
    const members = useMembers();
    const invites = usePendingInvitations();
    const invite = useInviteMember();
    const removeMember = useRemoveMember();
    const cancelInvite = useCancelInvitation();
    const updateRole = useUpdateMemberRole();
    const customRoles = useRoles();
    const { config: authConfig, ready: authConfigReady } = useAuthConfig();
    const currentUserId = useAppStore((s) => s.user?.id);
    const currentOrg = useAppStore((s) => s.currentOrganization);

    const memberList = members.data ?? [];
    const inviteList = invites.data ?? [];

    function doRemove(id: string, label: string) {
        confirm?.show(`להסיר את ${label}?`, async () => {
            try {
                await toast.promise(removeMember.mutateAsync(id), {
                    loading: "מסיר…",
                    success: "חבר הצוות הוסר",
                    error: (e: AppError) => buildError(e),
                });
            } catch {
                /* surfaced */
            }
        });
    }
    function doCancelInvite(id: string) {
        confirm?.show(`לבטל הזמנה זו?`, async () => {
            try {
                await toast.promise(cancelInvite.mutateAsync(id), {
                    loading: "מבטל…",
                    success: "ההזמנה בוטלה",
                    error: (e: AppError) => buildError(e),
                });
            } catch {
                /* surfaced */
            }
        });
    }
    async function copyInviteLink(invitationId: string) {
        try {
            const { token } = await getInvitationLink(invitationId);
            const url = `${window.location.origin}/invite?token=${encodeURIComponent(token)}`;
            await navigator.clipboard.writeText(url);
            toast.success("קישור ההזמנה הועתק");
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    }
    async function changeRoles(memberId: string, roleIds: string[]) {
        try {
            await toast.promise(
                updateRole.mutateAsync({ id: memberId, data: { role_ids: roleIds } }),
                {
                    loading: "שומר…",
                    success: "התפקידים עודכנו",
                    error: (e: AppError) => buildError(e),
                },
            );
        } catch {
            /* surfaced */
        }
    }

    return (
        <SectionShell
            title="חברי צוות"
            description={`כל בעלי הגישה אל ${currentOrg?.name ?? "סביבת עבודה זו"}.`}
        >
            {access.canManage && (
                <Section
                    eyebrow="הזמן חברי צוות"
                    description="הדבק מספר כתובות אימייל — נפריד ביניהן אוטומטית. בחר תפקיד; תוכל לשנות אותו בכל עת."
                >
                    <InviteFlow
                        pending={invite.isPending}
                        mailDelivers={!authConfigReady || authConfig.mail_delivers}
                        customRoles={customRoles.data ?? []}
                        onSubmit={async (emails, roleIds) => {
                            let ok = 0;
                            let failed = 0;
                            for (const e of emails) {
                                try {
                                    await invite.mutateAsync({ email: e, role_ids: roleIds });
                                    ok++;
                                } catch {
                                    failed++;
                                }
                            }
                            if (ok && !failed) toast.success(`נשלחה הזמנה ל-${ok} ${ok === 1 ? "איש צוות" : "חברי צוות"}`);
                            else if (ok && failed) toast.success(`נשלחה הזמנה ל-${ok} · ${failed} נכשלו`);
                            else toast.error("כל ההזמנות נכשלו");
                        }}
                    />
                </Section>
            )}

            <Section
                eyebrow="חברי צוות"
                description={`${memberList.length} ${memberList.length === 1 ? "חבר צוות" : "חברי צוות"} בסביבת עבודה זו.`}
            >
                {members.isPending ? (
                    <p className="text-[11.5px] text-slate-400 py-2">טוען…</p>
                ) : memberList.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400 py-2">אין עדיין חברי צוות.</p>
                ) : (
                    <TableSurface>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left rtl:text-right">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <Th>חבר צוות</Th>
                                    <Th className="md:w-44">תפקיד</Th>
                                    <Th className="w-40 hidden md:table-cell">הצטרף ב-</Th>
                                    <th className="w-12 px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {memberList.map((m) => {
                                    const email = safeEmail(m.email) || `(user ${m.user_id.slice(0, 8)})`;
                                    const isSelf = m.user_id === currentUserId;
                                    const isOwner = m.role === "owner";
                                    return (
                                        <tr
                                            key={m.user_id}
                                            className="group h-12 border-b border-slate-200/60 last:border-0 hover:bg-slate-50/80 transition-colors"
                                        >
                                            <td className="px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="size-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                        <span className="text-[10px] font-semibold text-slate-600">
                                                            {initials(m.email, m.user_id)}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[12.5px] text-slate-900 truncate leading-tight">
                                                            {email}
                                                            {isSelf && (
                                                                <span className="mr-1.5 ml-1.5 text-[10px] text-slate-400 uppercase tracking-[0.1em]">
                                                                    אתה
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10.5px] text-slate-400 truncate font-mono leading-tight">
                                                            {m.user_id.slice(0, 8)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3">
                                                {access.canManage && !isOwner && !isSelf ? (
                                                    <RoleMultiSelect
                                                        roles={customRoles.data ?? []}
                                                        value={(m.roles ?? []).map((r) => r.id)}
                                                        onChange={(ids) => changeRoles(m.user_id, ids)}
                                                        pending={updateRole.isPending}
                                                    />
                                                ) : isOwner ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold rounded-sm px-1.5 py-0.5 border bg-sky-50 text-sky-700 border-sky-100">
                                                        <ShieldCheckIcon className="w-2.5 h-2.5" />
                                                        בעלים
                                                    </span>
                                                ) : (
                                                    <RoleChips roles={m.roles ?? []} />
                                                )}
                                            </td>
                                            <td className="px-3 font-mono text-[11px] text-slate-500 tabular-nums hidden md:table-cell">
                                                {m.joined_at
                                                    ? new Date(m.joined_at).toLocaleDateString("he-IL", { month: "short", day: "numeric", year: "numeric" })
                                                    : "—"}
                                            </td>
                                            <td className="px-3">
                                                {access.canManage && !isOwner && !isSelf && (
                                                    <button
                                                        type="button"
                                                        onClick={() => doRemove(m.user_id, email)}
                                                        aria-label="הסר חבר צוות"
                                                        className="size-6 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                                                    >
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </TableSurface>
                )}
            </Section>

            <Section
                eyebrow="הזמנות בהמתנה"
                description={`${inviteList.length} ממתינות לאישור.`}
            >
                {invites.isPending ? (
                    <p className="text-[11.5px] text-slate-400 py-2">טוען…</p>
                ) : inviteList.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400 py-2">אין הזמנות בהמתנה. הזמן חבר צוות למעלה.</p>
                ) : (
                    <TableSurface>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left rtl:text-right">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <Th>אימייל</Th>
                                    <Th className="w-32">תפקיד</Th>
                                    <Th className="w-40 hidden md:table-cell">פג תוקף</Th>
                                    <th className="w-16 md:w-32 px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {inviteList.map((inv) => (
                                    <tr
                                        key={inv.id}
                                        className="group h-11 border-b border-slate-200/60 last:border-0 hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="px-4">
                                            <div className="flex items-center gap-2.5">
                                                <MailIcon className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[12.5px] text-slate-900 truncate" dir="ltr">
                                                    {inv.email}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3">
                                            {(inv.roles?.length ?? 0) > 0 ? <RoleChips roles={inv.roles!} /> : <RolePill role={inv.role} color={(customRoles.data ?? []).find((r) => r.id === inv.role_id)?.color} />}
                                        </td>
                                        <td className="px-3 font-mono text-[11px] text-slate-500 tabular-nums hidden md:table-cell" dir="ltr">
                                            {new Date(inv.expires_at).toLocaleDateString("he-IL", { month: "short", day: "numeric" })}
                                        </td>
                                        <td className="px-3">
                                            {access.canManage && (
                                                <div className="flex items-center gap-0.5 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyInviteLink(inv.id)}
                                                        aria-label="העתק קישור הזמנה"
                                                        title="העתק קישור הזמנה"
                                                        className="size-6 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                                                    >
                                                        <CopyIcon className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => doCancelInvite(inv.id)}
                                                        aria-label="בטל הזמנה"
                                                        title="בטל הזמנה"
                                                        className="size-6 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                                                    >
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </TableSurface>
                )}
            </Section>
        </SectionShell>
    );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <th
            className={`px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] ${className ?? ""}`}
        >
            {children}
        </th>
    );
}


/**
 * Multi-email invite flow. Email chips + role selector + send button,
 * with the role-description rail on the right so the owner sees what
 * they're granting before committing.
 */
function InviteFlow({
    onSubmit,
    pending,
    mailDelivers,
    customRoles,
}: {
    onSubmit: (emails: string[], roleIds: string[]) => Promise<void>;
    pending: boolean;
    mailDelivers: boolean;
    customRoles: OrganizationRole[];
}) {
    const [chips, setChips] = React.useState<{ email: string; valid: boolean }[]>([]);
    const [draft, setDraft] = React.useState("");
    const [roleIds, setRoleIds] = React.useState<string[]>([]);
    // Default to the seeded Viewer (least privilege), else the first role.
    const defaultRole = customRoles.find((r) => r.name === "Viewer") ?? customRoles[0];
    const effectiveRoleIds = roleIds.length > 0 ? roleIds : defaultRole ? [defaultRole.id] : [];
    const selectedRoles = customRoles.filter((r) => effectiveRoleIds.includes(r.id));
    const SEPARATOR_RE = /[\s,;]+/;

    function commitDrafts(value: string) {
        const parts = value.split(SEPARATOR_RE).map((s) => s.trim()).filter(Boolean);
        if (parts.length === 0) return;
        setChips((curr) => {
            const seen = new Set(curr.map((c) => c.email.toLowerCase()));
            const next = [...curr];
            for (const p of parts) {
                const key = p.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                next.push({ email: p, valid: isValidEmail(p) });
            }
            return next;
        });
    }

    function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault();
            commitDrafts(draft);
            setDraft("");
        } else if (e.key === "," || e.key === ";" || e.key === " ") {
            if (draft.trim()) {
                e.preventDefault();
                commitDrafts(draft);
                setDraft("");
            }
        } else if (e.key === "Backspace" && draft === "") {
            setChips((c) => c.slice(0, -1));
        }
    }

    function removeChip(email: string) {
        setChips((c) => c.filter((x) => x.email !== email));
    }

    async function submit() {
        if (draft.trim()) commitDrafts(draft);
        const final = [
            ...chips.map((c) => c.email),
            ...draft.split(SEPARATOR_RE).map((s) => s.trim()).filter(Boolean),
        ];
        const unique = Array.from(new Set(final.map((s) => s.toLowerCase())));
        const valid = unique.filter(isValidEmail);
        const invalid = unique.filter((e) => !isValidEmail(e));

        if (invalid.length > 0 && valid.length === 0) {
            toast.error("לא הוזנו כתובות אימייל תקינות");
            return;
        }
        if (invalid.length > 0) {
            toast(`מדלג על ${invalid.length} כתובות לא תקינות: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`, {
                icon: "⚠️",
            });
        }
        if (effectiveRoleIds.length === 0) {
            toast.error("צור תפקיד תחילה (הגדרות ← תפקידים והרשאות)");
            return;
        }
        await onSubmit(valid, effectiveRoleIds);
        setChips([]);
        setDraft("");
    }

    const totalCount = chips.length + (draft.trim() ? draft.trim().split(SEPARATOR_RE).filter(Boolean).length : 0);
    const activeLabel =
        selectedRoles.length === 0
            ? "אין תפקידים עדיין"
            : selectedRoles.map((r) => r.name).join(", ");
    const activeDescription =
        selectedRoles.length === 0
            ? "צור תפקיד תחת הגדרות ← תפקידים והרשאות לפני הזמנת חברי צוות."
            : selectedRoles.length === 1
                ? (selectedRoles[0].description || "הרשאות תפקיד זה יחולו על המוזמן.")
                : "המוזמן יקבל את שילוב ההרשאות של כל התפקידים שנבחרו.";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
            <div className="space-y-3">
                {/* MAIL_TRANSPORT=log puts the invitation in the backend log,
                    not in anyone's inbox. Say so before they wait for it. */}
                {!mailDelivers && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                        <MailIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            שרת זה אינו שולח דואר, לכן הודעת ההזמנה לא תגיע במייל. הזמן את המשתמש בכל זאת, ולאחר מכן השתמש ב-<span className="font-medium">העתק קישור הזמנה</span> בשורה שלו תחת הזמנות בהמתנה ושלח לו אותו ידנית.
                        </span>
                    </div>
                )}

                <div>
                    <Label>כתובות אימייל</Label>
                    <div
                        className="min-h-[36px] w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white flex flex-wrap items-center gap-1.5 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition-colors"
                        onClick={(e) => {
                            const input = (e.currentTarget as HTMLDivElement).querySelector("input");
                            input?.focus();
                        }}
                    >
                        {chips.map((c) => (
                            <span
                                key={c.email}
                                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium max-w-full min-w-0 ${
                                    c.valid ? "bg-slate-100 text-slate-700" : "bg-red-50 text-red-700"
                                }`}
                            >
                                <span className="truncate min-w-0" dir="ltr">{c.email}</span>
                                <button
                                    type="button"
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        removeChip(c.email);
                                    }}
                                    className="opacity-60 hover:opacity-100 shrink-0"
                                    aria-label={`הסר את ${c.email}`}
                                >
                                    <XIcon className="w-2.5 h-2.5" />
                                </button>
                            </span>
                        ))}
                        <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={onKey}
                            onPaste={(e) => {
                                const text = e.clipboardData.getData("text");
                                if (SEPARATOR_RE.test(text)) {
                                    e.preventDefault();
                                    commitDrafts(text);
                                    setDraft("");
                                }
                            }}
                            onBlur={() => {
                                if (draft.trim()) {
                                    commitDrafts(draft);
                                    setDraft("");
                                }
                            }}
                            placeholder={chips.length === 0 ? "name@company.com, another@…" : ""}
                            dir="ltr"
                            className="flex-1 min-w-[120px] h-5 bg-transparent text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none text-left"
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                        הפרד באמצעות פסיק, נקודה-פסיק, רווח או Enter. הדבק רשימה – נפצל אותה אוטומטית.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Label className="!mb-0 w-16">תפקידים</Label>
                    <RoleMultiSelect
                        roles={customRoles}
                        value={effectiveRoleIds}
                        onChange={setRoleIds}
                    />
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                        {totalCount > 0
                            ? `${totalCount} ${totalCount === 1 ? "כתובת אימייל מוכנה" : "כתובות אימייל מוכנות"}`
                            : "הזן לפחות כתובת אימייל אחת."}
                    </span>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={pending || (chips.length === 0 && draft.trim() === "")}
                        className="mr-auto rtl:mr-auto rtl:ml-0 ltr:ml-auto h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                    >
                        {pending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <SendIcon className="w-3 h-3 rtl:rotate-180" />}
                        שלח הזמנות
                    </button>
                </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-1.5 flex items-center gap-1.5">
                    <CheckIcon className="w-3 h-3 text-slate-400" />
                    {activeLabel}
                </div>
                <p className="text-[12px] text-slate-700 leading-relaxed">
                    {activeDescription}
                </p>
            </div>
        </div>
    );
}
