// Active-days picker - a roomier grid of 7 day cells backed by a uint8
// day-of-week bitmask (bit i = weekday i, 0=Mon..6=Sun). On-theme: sky
// active, slate idle, h-12 rounded-md cells with a label over a
// status dot. Supports both legacy string arrays and explicit mask items.

export type WeekdayItem = string | { label: string; mask: number };

export default function WeekdayBitmask({
    weekdays,
    value,
    setValue,
}: {
    weekdays: WeekdayItem[];
    value: number;
    setValue: (v: number) => void;
}) {
    return (
        <div className="grid grid-cols-7 gap-1.5" dir="rtl">
            {weekdays.map((item, index) => {
                const label = typeof item === "string" ? item : item.label;
                const mask = typeof item === "string" ? 1 << index : item.mask;
                const active = (value & mask) !== 0;
                return (
                    <button
                        key={typeof item === "string" ? item : `${item.label}-${item.mask}`}
                        type="button"
                        aria-pressed={active}
                        title={label}
                        onClick={() => setValue(value ^ mask)}
                        className={`h-12 rounded-md border flex flex-col items-center justify-center transition-colors ${
                            active
                                ? "border-sky-500 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        }`}
                    >
                        <span className="text-[11px] font-medium">{label.length <= 5 ? label : label.slice(0, 3)}</span>
                        <span
                            className={`mt-1 size-1.5 rounded-full ${
                                active ? "bg-sky-500" : "bg-slate-300"
                            }`}
                        />
                    </button>
                );
            })}
        </div>
    );
}
