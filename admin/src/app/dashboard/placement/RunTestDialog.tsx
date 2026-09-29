// Runs a placement test on the instance panel from any connected mailbox,
// outside every workspace allowance.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    createPlacementTest,
    searchPlacementSeedCandidates,
    type AdminPlacementSeed,
    type PlacementTestView,
    type PlacementTracking,
} from "@/lib/api/client/admin/placement";
import { describeError } from "./format";
import { useDebounced } from "./useDebounced";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRACKING_OPTIONS: { value: PlacementTracking; label: string }[] = [
    { value: "campaign", label: "ברירת מחדל: ללא מעקב לבדיקה חד-פעמית" },
    { value: "off", label: "כבוי: ללא פיקסל פתיחה, קישורים נשארים כפי שנכתבו" },
    { value: "on", label: "פעיל: פיקסל פתיחה ומעקב לחיצות" },
    { value: "compare", label: "השוואה: בדיקה אחת ללא מעקב ואחת עם מעקב" },
];

export function RunTestDialog({
    open,
    onOpenChange,
    onStarted,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStarted: (tests: PlacementTestView[]) => void;
}) {
    const qc = useQueryClient();
    const [sender, setSender] = useState<{ id: string; email: string } | null>(null);
    const [senderQuery, setSenderQuery] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyPlain, setBodyPlain] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [tracking, setTracking] = useState<PlacementTracking>("campaign");
    const [failure, setFailure] = useState<{ message: string; code?: string } | null>(null);

    function reset() {
        setSender(null);
        setSenderQuery("");
        setSubject("");
        setBodyPlain("");
        setBodyHtml("");
        setTracking("campaign");
        setFailure(null);
    }

    const debounced = useDebounced(senderQuery.trim(), 250);
    const isId = UUID_RE.test(debounced);
    const candidatesQ = useQuery({
        queryKey: ["admin", "placement", "candidates", "sender", debounced],
        queryFn: () => searchPlacementSeedCandidates(debounced, 20),
        enabled: open && !sender && debounced.length >= 2 && !isId,
        staleTime: 30_000,
    });
    // A seed cannot send a test, and an inactive mailbox cannot send at all.
    const senders = (candidatesQ.data ?? []).filter((m) => m.seed_scope === "" && m.status === "active");

    const senderId = sender?.id ?? (UUID_RE.test(senderQuery.trim()) ? senderQuery.trim() : "");

    const create = useMutation({
        mutationFn: () =>
            createPlacementTest({
                sender_account_id: senderId,
                subject: subject.trim(),
                body_plain: bodyPlain.trim() || undefined,
                body_html: bodyHtml.trim() || undefined,
                tracking,
            }),
        onSuccess: (tests) => {
            toast.success(tests.length > 1 ? "השוואת מעקב הופעלה" : "בדיקת מיקום הופעלה");
            qc.invalidateQueries({ queryKey: ["admin", "placement"] });
            reset();
            onStarted(tests);
        },
        onError: (err) => setFailure(describeError(err)),
    });

    const problem = !senderId
        ? "בחר את תיבת הדואר לשליחה, או הדבק את המזהה שלה."
        : !subject.trim()
          ? "הזן נושא."
          : !bodyPlain.trim() && !bodyHtml.trim()
            ? "הזן תוכן טקסט רגיל או HTML."
            : null;

    function pick(m: AdminPlacementSeed) {
        setSender({ id: m.id, email: m.email });
        setSenderQuery("");
        setFailure(null);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v && !create.isPending) setFailure(null);
                onOpenChange(v);
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>הרצת בדיקת מיקום</DialogTitle>
                    <DialogDescription>
                        שולח עותק אחד לכל תיבת בדיקה בפאנל המערכת מתיבת הדואר שתבחר, במרווחי זמן מדורגים, ומדווח היכן
                        כל עותק נחת. בדיקות מנהל מערכת אינן נספרות במכסה החודשית של סביבת העבודה, אך כל עותק נספר
                        במגבלת השליחה היומית של תיבת הדואר.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label className="text-xs">תיבת דואר שולחת</Label>
                        {sender ? (
                            <div className="mt-1 flex h-8 items-center justify-between gap-2 rounded-md border border-border px-2.5 text-[12.5px]">
                                <span className="truncate font-mono" dir="ltr">
                                    {sender.email}
                                </span>
                                <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    title="החלף תיבת דואר"
                                    onClick={() => setSender(null)}
                                >
                                    <X />
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Input
                                    value={senderQuery}
                                    onChange={(e) => {
                                        setSenderQuery(e.target.value);
                                        setFailure(null);
                                    }}
                                    placeholder="חיפוש לפי כתובת, או הדבקת מזהה תיבת דואר"
                                    className="mt-1 h-8 text-[12.5px]"
                                    autoComplete="off"
                                />
                                {debounced.length >= 2 && !isId && (
                                    <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border">
                                        {candidatesQ.isLoading ? (
                                            <div className="px-2.5 py-2 text-xs text-muted-foreground">מחפש…</div>
                                        ) : senders.length === 0 ? (
                                            <div className="px-2.5 py-2 text-xs text-muted-foreground">
                                                לא נמצאה תיבת דואר פעילה תואמת. תיבות בדיקה אינן יכולות לשלוח בדיקה.
                                            </div>
                                        ) : (
                                            senders.map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => pick(m)}
                                                    className="flex w-full items-center justify-between gap-2 border-b border-border px-2.5 py-1.5 text-start text-[12.5px] last:border-b-0 hover:bg-muted/50"
                                                >
                                                    <span className="truncate font-mono" dir="ltr">
                                                        {m.email}
                                                    </span>
                                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                                        {m.family_label}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="placement-subject" className="text-xs">
                            נושא
                        </Label>
                        <Input
                            id="placement-subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="mt-1 h-8 text-[12.5px]"
                        />
                    </div>

                    <div>
                        <Label htmlFor="placement-plain" className="text-xs">
                            תוכן טקסט רגיל
                        </Label>
                        <Textarea
                            id="placement-plain"
                            value={bodyPlain}
                            onChange={(e) => setBodyPlain(e.target.value)}
                            rows={4}
                            className="mt-1 text-[12.5px]"
                        />
                    </div>

                    <div>
                        <Label htmlFor="placement-html" className="text-xs">
                            תוכן HTML
                        </Label>
                        <Textarea
                            id="placement-html"
                            value={bodyHtml}
                            onChange={(e) => setBodyHtml(e.target.value)}
                            rows={4}
                            placeholder="אופציונלי. השאר ריק לשליחת טקסט רגיל בלבד."
                            className="mt-1 font-mono text-[12px]"
                        />
                    </div>

                    <div>
                        <Label className="text-xs">מעקב</Label>
                        <Select value={tracking} onValueChange={(v) => setTracking(v as PlacementTracking)}>
                            <SelectTrigger className="mt-1 h-8 w-full text-[12.5px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TRACKING_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value} className="text-[12.5px]">
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {tracking === "compare" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                שתי בדיקות לאותן תיבות בדיקה, כלומר כפול שליחות מתיבת הדואר.
                            </p>
                        )}
                    </div>

                    {failure && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                            {failure.message}
                            {failure.code && (
                                <span className="ms-1.5 font-mono text-red-600/80" dir="ltr">
                                    ({failure.code})
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">{problem ?? ""}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
                            ביטול
                        </Button>
                        <Button onClick={() => create.mutate()} disabled={!!problem || create.isPending}>
                            {create.isPending ? "מתחיל…" : "התחל בדיקה"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
