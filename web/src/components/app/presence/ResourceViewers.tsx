import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useResourceViewers } from "@/hooks/PresenceProvider";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function initialsOf(name: string | null) {
    if (!name) return "?";
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

const ACTION_LABEL: Record<string, string> = {
    viewing: "viewing",
    editing: "editing",
    replying: "replying",
};

const ACTION_LABEL_HE: Record<string, string> = {
    viewing: "צופה",
    editing: "עורך/ת",
    replying: "משיב/ה",
};

/**
 * "Someone is already here" indicator for detail panes and editors. Renders
 * nothing when the record has no other live viewers; otherwise an avatar
 * stack plus the strongest activity ("editing"/"replying" beats "viewing").
 */
export default function ResourceViewers({
    resource,
    className,
}: {
    resource: string | null;
    className?: string;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");
    const viewers = useResourceViewers(resource);
    if (viewers.length === 0) return null;

    const strongest =
        viewers.find((v) => v.action === "replying") ??
        viewers.find((v) => v.action === "editing") ??
        viewers[0];
    const rawAction = strongest.action ?? "viewing";
    const action = ACTION_LABEL[rawAction] ?? "viewing";
    const actionHe = ACTION_LABEL_HE[rawAction] ?? "צופה";
    const hot = action === "editing" || action === "replying";
    const teammate = strongest.name ?? (isHe ? "חבר צוות" : "A teammate");
    const label =
        viewers.length === 1
            ? isHe
                ? `${teammate} ${actionHe}`
                : `${teammate} is ${action}`
            : isHe
                ? `${teammate} ועוד ${viewers.length - 1} ${actionHe}`
                : `${teammate} +${viewers.length - 1} ${action}`;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 h-5 ps-1 pe-2 rounded-full border text-[10px] font-medium whitespace-nowrap",
                hot
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                className,
            )}
            title={viewers.map((v) => v.name ?? (isHe ? "חבר צוות" : "Teammate")).join(", ")}
        >
            <span className="flex -space-x-1 rtl:space-x-reverse">
                {viewers.slice(0, 3).map((v) => (
                    <Avatar key={v.userId} className="size-3.5 ring-1 ring-white">
                        {v.avatar ? <AvatarImage src={v.avatar} alt={v.name ?? ""} /> : null}
                        <AvatarFallback
                            className={cn(
                                "text-[6.5px] font-semibold",
                                hot ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
                            )}
                        >
                            {initialsOf(v.name)}
                        </AvatarFallback>
                    </Avatar>
                ))}
            </span>
            {label}
            {hot && (
                <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                </span>
            )}
        </span>
    );
}
