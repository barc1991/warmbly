// App-wide banner for a workspace whose sending is restricted or suspended.
//
// Without it the only symptom is volume quietly dropping, or campaigns that
// never send, with nothing anywhere saying why. Not dismissible: it describes
// an active limit on the account, not a notice.

import { AlertTriangleIcon, OctagonXIcon } from "lucide-react";
import useOrganizationRisk from "@/lib/api/hooks/app/organizations/useOrganizationRisk";

export default function SendingRestrictedBar() {
    const { data } = useOrganizationRisk();
    if (!data || (!data.restricted && !data.suspended)) return null;

    const suspended = data.suspended;
    const Icon = suspended ? OctagonXIcon : AlertTriangleIcon;

    return (
        <div
            role="status"
            className={`flex items-start gap-2 px-4 py-2.5 border-b ${
                suspended
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
        >
            <Icon className={`w-4 h-4 mt-px shrink-0 ${suspended ? "text-rose-600" : "text-amber-600"}`} />
            <div className="min-w-0 text-[12.5px] leading-relaxed">
                <span className="font-medium">
                    {suspended
                        ? "השליחה מושהית עבור מרחב עבודה זה בזמן שהוא בבדיקה."
                        : "השליחה ממרחב עבודה זה מוגבלת בזמן שהוא בבדיקה."}
                </span>{" "}
                {!suspended && (
                    <>
                        הנפח היומי לתיבת דואר מופחת והחימום פועל במאגר השיתופי.{" "}
                    </>
                )}
                {data.reason ? <>סיבה: {data.reason}. </> : null}
                פנה לתמיכה אם לדעתך חלה טעות.
            </div>
        </div>
    );
}
