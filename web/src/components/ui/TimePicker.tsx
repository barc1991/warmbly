// TimePicker — the house time field, replacing the native <input type="time">.
// Built on the themed SelectMenu (no OS dropdown chrome). Value is "HH:mm" (24h),
// the same shape the native input used, so it's a drop-in.

import React from "react";
import { SelectMenu } from "@/components/ui/select-menu";

// 24-hour clock format "14:30"
function fmt24(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TimePicker({
    value,
    onChange,
    stepMinutes = 30,
    placeholder = "כל שעה",
    className,
    fullWidth = false,
    minWidth,
    disabled = false,
}: {
    /** "HH:mm" (24h), or "" when unset. */
    value: string;
    onChange: (value: string) => void;
    stepMinutes?: number;
    placeholder?: string;
    className?: string;
    fullWidth?: boolean;
    minWidth?: number;
    disabled?: boolean;
}) {
    const options = React.useMemo(() => {
        const out: { value: string; label: string }[] = [];
        for (let mins = 0; mins < 24 * 60; mins += stepMinutes) {
            const v = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
            out.push({ value: v, label: fmt24(v) });
        }
        // Keep an off-grid current value (e.g. "09:15" with a 30-min step) selectable.
        if (value && !out.some((o) => o.value === value)) {
            out.push({ value, label: fmt24(value) });
            out.sort((a, b) => a.value.localeCompare(b.value));
        }
        return out;
    }, [stepMinutes, value]);

    return (
        <SelectMenu
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            className={className}
            fullWidth={fullWidth}
            minWidth={minWidth ?? 140}
            disabled={disabled}
        />
    );
}

export default TimePicker;
