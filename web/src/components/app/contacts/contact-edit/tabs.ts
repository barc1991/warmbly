// Tab definitions for the contact slide-over. Kept in a tiny module
// so the panel + each tab component can import the same enum without
// circular deps.
//
// Order matches the visible tab strip in the slide-over header.

import type { LucideIcon } from "lucide-react";
import {
    GaugeIcon,
    ActivityIcon,
    StickyNoteIcon,
    SlidersHorizontalIcon,
    SparklesIcon,
} from "lucide-react";

export type ContactSlideTab = "overview" | "activity" | "notes" | "details" | "research";

export const CONTACT_SLIDE_TABS: { id: ContactSlideTab; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "סקירה כללית", icon: GaugeIcon },
    { id: "activity", label: "פעילות", icon: ActivityIcon },
    { id: "notes", label: "הערות", icon: StickyNoteIcon },
    { id: "research", label: "מחקר ומידע", icon: SparklesIcon },
    { id: "details", label: "פרטים", icon: SlidersHorizontalIcon },
];
