// The campaign's entry delay picker: preset chips plus a custom amount + unit.
// Rendered both on the Schedule tab and inside the flow canvas's trigger node,
// which edit the same campaigns.entry_delay_minutes value.
import React from "react";
import { NumberInput } from "@/components/ui/field";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";
import {
    ENTRY_DELAY_MAX_MINUTES,
    ENTRY_DELAY_PRESETS,
    ENTRY_DELAY_UNIT_MINUTES,
    splitEntryDelay,
    type EntryDelayUnit,
} from "./entryDelay";

const UNIT_OPTIONS: SelectOption[] = [
    { value: "minutes", label: "minutes" },
    { value: "hours", label: "hours" },
    { value: "days", label: "days" },
];

/**
 * The amount and unit are held here rather than derived from `value` on every
 * render, so the field stays responsive for a parent that only listens for the
 * settled value.
 *
 * `onChange` fires on every edit — for a parent batching into a Save button.
 * `onCommit` fires only when the value settles (a preset, a unit change, blur /
 * Enter / a stepper click) — for a parent that persists immediately, which must
 * not send one request per keystroke.
 */
export default function EntryDelayPicker({
    value,
    onChange,
    onCommit,
    disabled,
}: {
    value: number;
    onChange?: (minutes: number) => void;
    onCommit?: (minutes: number) => void;
    disabled?: boolean;
}) {
    const isPreset = ENTRY_DELAY_PRESETS.some((p) => p.minutes === value);
    // "Custom" stays open once chosen, even while the typed value happens to
    // land on a preset, so typing 2 -> 24 hours does not yank the row away.
    const [custom, setCustom] = React.useState(!isPreset);
    const [draft, setDraft] = React.useState(() => splitEntryDelay(value));
    // Re-seed when the value moves for a reason other than this field: a save
    // landing, the Schedule tab's Reset, a teammate's edit arriving live.
    React.useEffect(() => setDraft(splitEntryDelay(value)), [value]);

    const clamp = (minutes: number) => Math.max(0, Math.min(ENTRY_DELAY_MAX_MINUTES, minutes));

    const pick = (minutes: number) => {
        setCustom(false);
        setDraft(splitEntryDelay(minutes));
        onChange?.(minutes);
        onCommit?.(minutes);
    };

    const editCustom = (amount: number, unit: EntryDelayUnit, settled: boolean) => {
        setDraft({ amount, unit });
        const minutes = clamp(Math.round(amount) * ENTRY_DELAY_UNIT_MINUTES[unit]);
        onChange?.(minutes);
        if (settled) onCommit?.(minutes);
    };

    const chip = (active: boolean) =>
        `h-7 px-2.5 rounded-md border text-[11.5px] transition-colors disabled:opacity-50 ${
            active
                ? "border-sky-300 bg-sky-50 text-sky-700 font-medium"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
        }`;

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {ENTRY_DELAY_PRESETS.map((p) => (
                    <button
                        key={p.minutes}
                        type="button"
                        disabled={disabled}
                        onClick={() => pick(p.minutes)}
                        className={chip(!custom && value === p.minutes)}
                    >
                        {p.label}
                    </button>
                ))}
                <button type="button" disabled={disabled} onClick={() => setCustom(true)} className={chip(custom)}>
                    Custom
                </button>
            </div>
            {custom && (
                <div className="flex items-center gap-2">
                    <div className="w-[110px]">
                        <NumberInput
                            value={draft.amount}
                            onChange={(v) => editCustom(v, draft.unit, false)}
                            onCommit={(v) => editCustom(v, draft.unit, true)}
                            min={0}
                            max={ENTRY_DELAY_MAX_MINUTES / ENTRY_DELAY_UNIT_MINUTES[draft.unit]}
                            disabled={disabled}
                        />
                    </div>
                    <SelectMenu
                        value={draft.unit}
                        onChange={(u) => editCustom(draft.amount, u as EntryDelayUnit, true)}
                        options={UNIT_OPTIONS}
                        minWidth={130}
                        disabled={disabled}
                        aria-label="Delay unit"
                    />
                </div>
            )}
        </div>
    );
}
