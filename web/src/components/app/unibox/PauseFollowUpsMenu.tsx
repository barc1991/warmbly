// The reply composer's follow-up pause: armed here, applied by the composer once the reply is accepted.

import { CheckIcon, ChevronDownIcon, PauseIcon } from "lucide-react";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import { CheckSquare } from "@/components/ui/check-square";
import { FOLLOW_UP_PAUSES, tickedCampaigns, type FollowUpPause } from "@/lib/leadHold";
import { cn } from "@/lib/utils";

export default function PauseFollowUpsMenu({
    campaigns,
    skipped,
    onToggleCampaign,
    value,
    onChange,
    disabled = false,
}: {
    campaigns: { id: string; name: string }[];
    // Unticked campaigns; the last ticked one stays ticked, so an armed pause always has a target.
    skipped: string[];
    onToggleCampaign: (id: string) => void;
    value: FollowUpPause | null;
    onChange: (p: FollowUpPause | null) => void;
    disabled?: boolean;
}) {
    const ticked = tickedCampaigns(
        campaigns.map((c) => ({ ...c, campaign_id: c.id })),
        skipped,
    );
    const isTicked = (id: string) => ticked.some((c) => c.id === id);
    const armed = !!value;
    return (
        <PopoverMenu align="start" side="top">
            <PopoverMenuTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    title={
                        armed
                            ? `משהה איש קשר זה ב-${ticked.map((c) => c.name).join(", ")} בעת שליחת התשובה`
                            : "לאיש קשר זה עדיין יש הודעות המשך מעקב בתור. השהה אותן בעת שליחת התשובה."
                    }
                    className={cn(
                        "h-7 px-2 rounded-md border text-[12px] inline-flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        armed
                            ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                            : "border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900",
                    )}
                >
                    <PauseIcon className="w-3 h-3" />
                    {armed ? `השהה המשך מעקב: ${value.short}` : "השהה המשך מעקב"}
                    <ChevronDownIcon className={cn("w-3 h-3", armed ? "text-violet-400" : "text-slate-400")} />
                </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={240} className="max-w-[min(20rem,92vw)]">
                <PopoverMenuLabel>השהה המשך מעקב</PopoverMenuLabel>
                {campaigns.length === 1 && (
                    <div className="px-3 pb-1 text-[11.5px] text-slate-500 truncate" title={campaigns[0].name}>
                        ב-{campaigns[0].name}
                    </div>
                )}
                {FOLLOW_UP_PAUSES.map((p) => (
                    <PopoverMenuItem
                        key={p.label}
                        onSelect={() => onChange(p)}
                        selected={value?.label === p.label}
                        trailing={value?.label === p.label ? <CheckIcon className="w-3 h-3 text-sky-600" /> : undefined}
                    >
                        {p.label}
                    </PopoverMenuItem>
                ))}
                {campaigns.length > 1 && (
                    <>
                        <PopoverMenuSeparator />
                        <PopoverMenuLabel>ב-</PopoverMenuLabel>
                        {campaigns.map((c) => {
                            const on = isTicked(c.id);
                            return (
                                <PopoverMenuItem
                                    key={c.id}
                                    closeOnSelect={false}
                                    disabled={on && ticked.length === 1}
                                    onSelect={() => onToggleCampaign(c.id)}
                                    icon={<CheckSquare checked={on} />}
                                >
                                    <span className="truncate">{c.name}</span>
                                </PopoverMenuItem>
                            );
                        })}
                    </>
                )}
                {value && (
                    <>
                        <PopoverMenuSeparator />
                        <PopoverMenuItem onSelect={() => onChange(null)}>אל תשהה</PopoverMenuItem>
                    </>
                )}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}
