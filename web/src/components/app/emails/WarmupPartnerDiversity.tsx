import { cn } from "@/lib/utils";

export interface WarmupPartnerDiversityInfo {
    partner_mailboxes_7d?: number;
    partner_domains_7d?: number;
    partner_organizations_7d?: number;
}

export default function WarmupPartnerDiversity({
    health,
    className,
}: {
    health: WarmupPartnerDiversityInfo;
    className?: string;
}) {
    const mailboxes = health.partner_mailboxes_7d ?? 0;
    const domains = health.partner_domains_7d ?? 0;
    const organizations = health.partner_organizations_7d ?? 0;
    if (mailboxes <= 0) return null;

    return (
        <div className={cn("mt-2.5 text-right", className)}>
            <div className="flex items-center gap-4 text-[11.5px] text-slate-500">
                <span>
                    <b className="text-slate-900 tabular-nums">{mailboxes}</b> {mailboxes === 1 ? "שותף" : "שותפים"}
                </span>
                <span>
                    <b className="text-slate-900 tabular-nums">{domains}</b> {domains === 1 ? "דומיין" : "דומיינים"}
                </span>
                <span>
                    <b className="text-slate-900 tabular-nums">{organizations}</b> {organizations === 1 ? "סביבת עבודה" : "סביבות עבודה"}
                </span>
                <span className="text-slate-400">7 ימים אחרונים</span>
            </div>
            {mailboxes > 1 && organizations === 1 && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                    כל השותפים השבוע היו מתוך סביבת עבודה יחידה. חימום תיבות משיג את התוצאות הטובות ביותר על פני סביבות עבודה ודומיינים מגוונים.
                </p>
            )}
        </div>
    );
}
