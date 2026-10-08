// Status and folder badges for placement tests.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlacementFolder, PlacementStatus } from "@/lib/api/client/admin/placement";

const STATUS_LABEL: Record<PlacementStatus, string> = {
    running: "פעיל",
    completed: "הושלם",
    cancelled: "בוטל",
    failed: "נכשל",
};

const STATUS_TONE: Record<PlacementStatus, string> = {
    running: "border-amber-300 bg-amber-50 text-amber-700",
    completed: "border-emerald-300 bg-emerald-50 text-emerald-700",
    cancelled: "border-zinc-300 bg-zinc-50 text-zinc-600",
    failed: "border-red-300 bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
    const s = status as PlacementStatus;
    return (
        <Badge
            variant="outline"
            className={cn("text-[10px]", STATUS_TONE[s] ?? "border-zinc-300 text-zinc-600")}
        >
            {STATUS_LABEL[s] ?? status}
        </Badge>
    );
}

const FOLDER_LABEL: Record<PlacementFolder, string> = {
    pending: "ממתין",
    inbox: "תיבה ראשית",
    promotions: "קידומי מכירות",
    other: "לשונית אחרת",
    spam: "ספאם",
    missing: "חסר",
    unknown: "תיקייה לא ידועה",
    archive: "ארכיון",
    custom: "תיקייה מותאמת",
    failed: "נכשל",
    cancelled: "בוטל",
};

const FOLDER_TONE: Record<PlacementFolder, string> = {
    pending: "border-zinc-300 bg-zinc-50 text-zinc-600",
    inbox: "border-emerald-300 bg-emerald-50 text-emerald-700",
    promotions: "border-sky-300 bg-sky-50 text-sky-700",
    other: "border-sky-300 bg-sky-50 text-sky-700",
    spam: "border-red-300 bg-red-50 text-red-700",
    missing: "border-amber-300 bg-amber-50 text-amber-700",
    unknown: "border-zinc-300 bg-zinc-50 text-zinc-600",
    archive: "border-zinc-300 bg-zinc-50 text-zinc-600",
    custom: "border-zinc-300 bg-zinc-50 text-zinc-600",
    failed: "border-red-300 text-red-700",
    cancelled: "border-zinc-300 text-zinc-500",
};

export function FolderBadge({ folder }: { folder: string }) {
    const f = folder as PlacementFolder;
    return (
        <Badge variant="outline" className={cn("text-[10px]", FOLDER_TONE[f] ?? "border-zinc-300 text-zinc-600")}>
            {FOLDER_LABEL[f] ?? folder}
        </Badge>
    );
}
