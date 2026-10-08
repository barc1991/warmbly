// The unibox Compose button, in the list's title row on every viewport. The
// label is visually hidden on phones and the key hint below md.

import { PenLineIcon } from "lucide-react";
import ShortcutTooltip, { shortcutLabel } from "@/components/ui/shortcut-tooltip";
import { useComposeStore } from "@/hooks/useComposeStore";

export default function ComposeButton() {
    return (
        <ShortcutTooltip label="אימייל חדש" combo="n" side="bottom">
            <button
                type="button"
                onClick={() => useComposeStore.getState().openCompose()}
                className="h-7 px-2 sm:ps-2 sm:pe-2.5 md:pe-1.5 rounded-md text-[12px] font-medium text-sky-700 inline-flex items-center gap-1.5 hover:bg-sky-50 active:bg-sky-100 transition-colors shrink-0"
            >
                <PenLineIcon className="w-3.5 h-3.5" />
                <span className="sr-only sm:not-sr-only">כתיבה</span>
                <kbd aria-hidden className="hidden md:inline-flex h-4 min-w-4 justify-center items-center px-1 ms-0.5 rounded border border-sky-200 bg-white font-mono text-[10px] leading-none text-sky-600">
                    {shortcutLabel("n")}
                </kbd>
            </button>
        </ShortcutTooltip>
    );
}
