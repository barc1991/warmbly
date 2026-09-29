import { cn } from "@/lib/utils";

export interface WarmupPartnerDiversityInfo {
    partner_mailboxes_7d?: number;
    partner_domains_7d?: number;
    partner_organizations_7d?: number;
    received_7d?: number;
    senders_7d?: number;
}

export default function WarmupPartnerDiversity({ health, className }: { health: WarmupPartnerDiversityInfo; className?: string }) {
    const mailboxes = health.partner_mailboxes_7d ?? 0;
    const domains = health.partner_domains_7d ?? 0;
    const organizations = health.partner_organizations_7d ?? 0;
    const received = health.received_7d ?? 0;
    const senders = health.senders_7d ?? 0;
    if (mailboxes <= 0 && received <= 0) return null;

    // An older cloud answers without the receiving side; only judge it when it is there.
    const knowsReceived = health.received_7d !== undefined;
    const starving = knowsReceived && mailboxes >= 5 && received * 4 < mailboxes;

    return (
        <div className={cn("mt-2.5 text-start", className)}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
                <span>
                    נשלח אל <b className="text-slate-900 tabular-nums">{mailboxes}</b> {mailboxes === 1 ? "שותף" : "שותפים"}
                </span>
                <span>
                    <b className="text-slate-900 tabular-nums">{domains}</b> {domains === 1 ? "דומיין" : "דומיינים"}
                </span>
                <span>
                    <b className="text-slate-900 tabular-nums">{organizations}</b> {organizations === 1 ? "סביבת עבודה" : "סביבות עבודה"}
                </span>
                {knowsReceived && (
                    <span>
                        התקבלו <b className="text-slate-900 tabular-nums">{received}</b> מתוך <b className="text-slate-900 tabular-nums">{senders}</b> {senders === 1 ? "שותף" : "שותפים"}
                    </span>
                )}
                <span className="text-slate-400">7 ימים אחרונים</span>
            </div>
            {mailboxes > 1 && organizations === 1 && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                    כל השותפים השבוע היו מתוך סביבת עבודה יחידה. חימום תיבות משיג את התוצאות הטובות ביותר על פני סביבות עבודה ודומיינים מגוונים.
                </p>
            )}
            {starving && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                    תיבת דואר זו שולחת להרבה יותר שותפים ממה שמחזירים לה. מאגר החימום מעניק לה כעת עדיפות בכל הגרלה, והמספרים יתאזנו בימים הקרובים.
                </p>
            )}
        </div>
    );
}
