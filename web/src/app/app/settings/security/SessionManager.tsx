import toast from "react-hot-toast";
import { Monitor, Smartphone, Globe, LogOut } from "lucide-react";
import { Section } from "../_components/SectionShell";
import { Loading } from "@/components/loader";
import { useConfirm } from "@/hooks/context/confirm";
import useSessions from "@/lib/api/hooks/auth/useSessions";
import useRevokeSession from "@/lib/api/hooks/auth/useRevokeSession";
import useRevokeOtherSessions from "@/lib/api/hooks/auth/useRevokeOtherSessions";
import type ActiveSession from "@/lib/api/models/auth/ActiveSession";

const PROVIDER_LABELS: Record<string, string> = {
    email: "אימייל",
    google: "Google",
    apple: "Apple",
    oidc: "SSO (חיבור יחיד)",
    webauthn: "מפתח גישה (Passkey)",
};

function providerLabel(p: string): string | null {
    if (!p) return null;
    return PROVIDER_LABELS[p] ?? p;
}

function deviceLabel(s: ActiveSession): string {
    const browser = s.browser?.trim();
    const os = s.os?.trim();
    if (browser && os) return `${browser} ב-${os}`;
    return browser || os || "מכשיר לא ידוע";
}

function locationLabel(s: ActiveSession): string {
    const parts = [s.location_city, s.location_region, s.location_country]
        .map((p) => p?.trim())
        .filter((p): p is string => !!p && p.toLowerCase() !== "unknown");
    return parts.length ? Array.from(new Set(parts)).join(", ") : "מיקום לא ידוע";
}

function DeviceIcon({ os }: { os: string }) {
    const cls = "w-4 h-4 text-slate-500";
    if (!os) return <Globe className={cls} />;
    if (/ios|iphone|ipad|android/i.test(os)) return <Smartphone className={cls} />;
    return <Monitor className={cls} />;
}

function relTime(d: Date | string): string {
    const date = new Date(d);
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 45) return "כרגע";
    const min = Math.floor(sec / 60);
    if (min < 60) return `לפני ${Math.max(min, 1)} דק'`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `לפני ${hr} שע'`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `לפני ${day} ימ'`;
    return date.toLocaleDateString("he-IL", { month: "short", day: "numeric", year: "numeric" });
}

export default function SessionManager() {
    const { data: sessions, isLoading } = useSessions();
    const revoke = useRevokeSession();
    const revokeOthers = useRevokeOtherSessions();
    const confirm = useConfirm();

    const others = (sessions ?? []).filter((s) => !s.current);

    const handleRevoke = (s: ActiveSession) => {
        confirm?.show(
            `לנתק את ${deviceLabel(s)}? מכשיר זה יידרש להתחבר שוב.`,
            async () => {
                try {
                    await revoke.mutateAsync(s.id);
                    toast.success("ההפעלה נותקה בהצלחה");
                } catch {
                    toast.error("ניתוק ההפעלה נכשל.");
                }
            },
        );
    };

    const handleRevokeOthers = () => {
        confirm?.show(
            "לנתק את כל שאר ההפעלות? כל מכשיר מלבד מכשיר זה יידרש להתחבר שוב.",
            async () => {
                try {
                    await revokeOthers.mutateAsync();
                    toast.success("כל שאר המכשירים נותקו בהצלחה");
                } catch {
                    toast.error("ניתוק שאר המכשירים נכשל.");
                }
            },
        );
    };

    return (
        <Section
            eyebrow="הפעלות פעילות (Sessions)"
            description="מכשירים המחוברים כעת לחשבונך. נתק כל מכשיר שאינך מזהה."
        >
            <div className="space-y-3">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-[12px] text-slate-400 py-2">
                        <Loading className="!w-4 h-4 text-slate-400" /> טוען הפעלות פעילות…
                    </div>
                ) : sessions && sessions.length > 0 ? (
                    <div className="rounded-md border border-slate-200 divide-y divide-slate-200 bg-white">
                        {sessions.map((s) => {
                            const provider = providerLabel(s.auth_provider);
                            return (
                                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                        <DeviceIcon os={s.os} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12.5px] font-medium text-slate-900 truncate">
                                                {deviceLabel(s)}
                                            </span>
                                            {s.current && (
                                                <span className="text-[10px] uppercase tracking-[0.08em] font-medium rounded-sm px-1 bg-sky-50 text-sky-700">
                                                    מכשיר זה
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                            {locationLabel(s)}
                                            {provider ? ` · ${provider}` : ""}
                                            {" · "}
                                            {s.current ? "פעיל כעת" : `פעיל ${relTime(s.last_active_at)}`}
                                        </div>
                                    </div>
                                    {!s.current && (
                                        <button
                                            type="button"
                                            onClick={() => handleRevoke(s)}
                                            disabled={revoke.isPending}
                                            className="h-7 px-2.5 inline-flex items-center justify-center rounded-md text-[12px] text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                                        >
                                            התנתק
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                        לא נמצאו הפעלות פעילות.
                    </p>
                )}

                {others.length > 0 && (
                    <button
                        type="button"
                        onClick={handleRevokeOthers}
                        disabled={revokeOthers.isPending}
                        className="h-8 px-3 rounded-md border border-slate-200 hover:border-red-300 hover:bg-red-50/50 text-[12.5px] font-medium text-slate-700 hover:text-red-700 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                        {revokeOthers.isPending ? (
                            <Loading className="!w-3.5 h-3.5 text-slate-500" />
                        ) : (
                            <LogOut className="w-3.5 h-3.5" />
                        )}
                        נתק את כל שאר המכשירים
                    </button>
                )}
            </div>
        </Section>
    );
}
