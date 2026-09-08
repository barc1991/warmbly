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
 * Controlled on the value, uncontrolled on which row is showing, so a parent can
 * batch into a Save button (Schedule tab) or persist immediately (canvas).
 */
export default function EntryDelayPicker({
    value,
    onChange,
    disabled,
}: {
    value: number;
    onChange: (minutes: number) => void;
    disabled?: boolean;
}) {
    const isPreset = ENTRY_DELAY_PRESETS.some((p) => p.minutes === value);
    // "Custom" stays open once chosen, even while the typed value happens to
    // land on a preset, so typing 2 -> 24 hours does not yank the row away.
    const [custom, setCustom] = React.useState(!isPreset);
    const { amount, unit } = splitEntryDelay(value);

    const setFromCustom = (nextAmount: number, nextUnit: EntryDelayUnit) => {
        const minutes = Math.round(nextAmount) * ENTRY_DELAY_UNIT_MINUTES[nextUnit];
        onChange(Math.max(0, Math.min(ENTRY_DELAY_MAX_MINUTES, minutes)));
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
                        onClick={() => {
                            setCustom(false);
                            onChange(p.minutes);
                        }}
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
                            value={amount}
                            onChange={(v) => setFromCustom(v, unit)}
                            min={0}
                            max={unit === "days" ? 90 : unit === "hours" ? 2160 : ENTRY_DELAY_MAX_MINUTES}
                            disabled={disabled}
                        />
                    </div>
                    <SelectMenu
                        value={unit}
                        onChange={(u) => setFromCustom(amount, u as EntryDelayUnit)}
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
