import { RiFireLine } from "@remixicon/react";

const HEALTHY_MIN = 20;

export default function WarmupCoverageNotice({
    warmupCount,
    totalCount,
    canWarmup,
    onAdd,
}: {
    warmupCount: number;
    totalCount: number;
    canWarmup: boolean;
    onAdd: () => void;
    onConnectCloud?: () => void;
    cloudConnected?: boolean;
}) {
    if (!canWarmup || warmupCount < 1 || warmupCount >= HEALTHY_MIN) return null;

    const critical = warmupCount < 2;
    const hasIdle = totalCount > warmupCount;

    const title = critical
        ? "חימום אינו יכול לפעול עם תיבת דואר אחת בלבד"
        : "מעט מדי תיבות דואר עבור חימום תקין";

    const body = critical
        ? "החימום פועל באמצעות שליחת הודעות בין תיבות הדואר שלך, ולכן תיבה בודדת אינה יכולה לתקשר."
        : `רק ${warmupCount} תיבות מתחממות כעת, כך שאותם חשבונות שולחים שוב ושוב ביניהם.`;

    return (
        <div className="px-5 pt-4">
            <div className="flex items-start gap-2.5 rounded-md border border-amber-200/70 bg-amber-50/70 px-3 py-2.5 text-amber-800">
                <RiFireLine className="w-4 h-4 mt-px shrink-0 text-amber-500" />
                <div className="min-w-0 text-[12.5px] leading-snug">
                    <span className="font-medium">{title}.</span>{" "}
                    <span className="text-amber-800/90">
                        {body} מאגר מומלץ כולל בין 20 ל-50 תיבות דואר להדרגה בטוחה.
                    </span>{" "}
                    <button
                        type="button"
                        onClick={onAdd}
                        className="font-medium underline underline-offset-2 hover:text-amber-950"
                    >
                        הוסף תיבות דואר
                    </button>
                    {hasIdle && (
                        <span className="text-amber-800/90">
                            {" "}(או הפעל חימום עבור התיבות שכבר יש לך).
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
