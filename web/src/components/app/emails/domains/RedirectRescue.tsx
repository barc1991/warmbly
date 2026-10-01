import React from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { AlertTriangleIcon, CloudIcon, Loader2Icon, XIcon } from "lucide-react";
import { useConfirm } from "@/hooks/context/confirm";
import buildError from "@/lib/helper/buildError";
import type { AppError } from "@/lib/api/client/normalizeError";
import type { SendingDomain } from "@/lib/api/models/app/emails/SendingDomain";
import { useSetDomainRedirect } from "@/lib/api/hooks/app/emails/useSendingDomains";
import CloudConnectDialog from "@/components/app/cloud/CloudConnectDialog";
import { PROXY_NAMES, redirectBlocked } from "./rules";
import { useCloudServing } from "./cloudServing";

const DISMISS_KEY = "warmbly.sendingDomains.redirectRescue";

export default function RedirectRescue({ all, onOpenDomain }: { all: SendingDomain[]; onOpenDomain: (domain: string) => void }) {
    const cloud = useCloudServing();
    const confirm = useConfirm();
    const save = useSetDomainRedirect();
    const [connecting, setConnecting] = React.useState(false);
    const [moving, setMoving] = React.useState<{ done: number; of: number } | null>(null);
    const [hidden, setHidden] = React.useState(() => localStorage.getItem(DISMISS_KEY) ?? "");

    const stuck = React.useMemo(
        () => all.filter((d) => d.redirect && d.redirect.served_by !== "cloud" && redirectBlocked(d.redirect)),
        [all],
    );
    const key = stuck.map((d) => d.domain).sort().join(",");
    if (!cloud.choosable || stuck.length === 0 || (hidden === key && !moving)) return null;

    const n = stuck.length;
    const room = cloud.offer ? Math.max(0, cloud.offer.limit - cloud.offer.used) : 0;
    const proxies = stuck.map((d) => d.redirect?.reach?.proxy ?? "").filter((p) => PROXY_NAMES[p]);
    const proxy = proxies.length > 0 && proxies.every((p) => p === proxies[0]) ? PROXY_NAMES[proxies[0]] : "";

    // One at a time: each is a round trip to Warmbly Cloud, and one refusal (its limit included) must not stop the rest.
    async function moveAll(list: SendingDomain[]) {
        setMoving({ done: 0, of: list.length });
        let moved = 0;
        let firstError = "";
        for (const d of list) {
            try {
                await save.mutateAsync({
                    domain: d.domain,
                    body: { target_url: d.redirect!.target_url, include_www: d.redirect!.include_www, served_by: "cloud" },
                });
                moved++;
            } catch (e) {
                firstError ||= `${d.domain}: ${buildError(e as AppError)}`;
            }
            setMoving((m) => (m ? { ...m, done: m.done + 1 } : m));
        }
        setMoving(null);
        if (moved > 0) {
            toast.success(
                moved === 1
                    ? "הועבר בהצלחה ל-Warmbly Cloud. החלף את רשומות ה-root ברשומות המוצגות."
                    : `${moved} הפניות הועברו בהצלחה ל-Warmbly Cloud. החלף את רשומות ה-root של כל אחת מהן.`,
            );
            onOpenDomain(list[0].domain);
        }
        if (firstError) toast.error(firstError);
    }

    function serveFromCloud() {
        confirm.show(
            `להגיש את ${n === 1 ? stuck[0].domain : `${n} הפניות אלו`} מ-Warmbly Cloud? לאחר מכן תכוון את רשומות ה-root אל Cloud, ללא כל שינוי בשרת שלך.`,
            () => moveAll(stuck),
        );
    }

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden shrink-0"
        >
            <div className="px-5 py-3 border-b border-slate-200">
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-start gap-3 text-start">
                    <div className="size-7 rounded-md bg-white border border-amber-100 text-amber-600 inline-flex items-center justify-center shrink-0">
                        <AlertTriangleIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-slate-900">
                            {n === 1 ? `${stuck[0].domain} אינו מגיע למבקרים` : `${n} הפניות אינן מגיעות למבקרים`}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-slate-600 leading-relaxed">
                            {n === 1 ? "רשומות ה-DNS הוגדרו נכון" : "רשומות ה-DNS הוגדרו נכון"}, אך{" "}
                            {proxy ? `${proxy} בשרת שלך עונה במקום Warmbly.` : "גורם כלשהו בשרת שלך חוסם את המעבר."}{" "}
                            {cloud.canServe
                                ? "Warmbly Cloud יכול להגיש אותן במקום, ללא צורך בשינויים בשרת שלך."
                                : !cloud.connected
                                  ? "חבר מופע זה ל-Warmbly Cloud (חינם), והוא יוכל להגיש אותן ללא כל שינוי בשרת שלך."
                                  : "כל דומיין מפרט את השינוי הנדרש בשרת הפרוקסי שלך."}
                            {cloud.canServe && n > room && ` ל-Cloud נותר מקום לעוד ${room.toLocaleString()} עבור מופע זה.`}
                        </p>
                        {moving && (
                            <div className="mt-2 h-1 rounded-full bg-amber-100 overflow-hidden max-w-xs">
                                <motion.div
                                    className="h-full rounded-full bg-sky-500"
                                    initial={false}
                                    animate={{ width: `${Math.round((moving.done / Math.max(moving.of, 1)) * 100)}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ms-auto">
                        <button
                            type="button"
                            onClick={() => onOpenDomain(stuck[0].domain)}
                            className="h-7 px-2.5 rounded-md text-[12px] text-slate-700 hover:text-slate-900 hover:bg-white transition-colors"
                        >
                            תקן בשרת שלי
                        </button>
                        {(cloud.canServe || !cloud.connected) && (
                            <button
                                type="button"
                                onClick={() => (cloud.canServe ? serveFromCloud() : setConnecting(true))}
                                disabled={!!moving}
                                className="h-7 px-2.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                            >
                                {moving ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CloudIcon className="w-3 h-3" />}
                                {moving
                                    ? `מעביר ${Math.min(moving.done + 1, moving.of)} מתוך ${moving.of}`
                                    : cloud.canServe
                                      ? "הגש מ-Warmbly Cloud"
                                      : "התחבר ל-Warmbly Cloud"}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                localStorage.setItem(DISMISS_KEY, key);
                                setHidden(key);
                            }}
                            disabled={!!moving}
                            aria-label="סגור"
                            className="size-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white inline-flex items-center justify-center transition-colors disabled:opacity-40"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
            <CloudConnectDialog
                open={connecting}
                onClose={() => setConnecting(false)}
            />
        </motion.div>
    );
}
