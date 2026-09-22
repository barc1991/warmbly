// One row in the conversation list.
//
// Three lines and nothing else: sender and time, subject, preview. No avatar,
// so the eye reads down one column of names the way it does in Superhuman or
// Hey. Unread is a dot in the gutter plus weight, which reads from across
// the room without a coloured bar. Labels sit at the end of the subject line
// as small tinted chips; the owning mailbox shows only when the workspace
// has more than one, quietly at the end of the preview.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArchiveIcon,
  InboxIcon,
  MailCheckIcon,
  MailOpenIcon,
  MoonIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from "lucide-react";

import {
  PopoverMenu,
  PopoverMenuContent,
  PopoverMenuItem,
  PopoverMenuLabel,
  PopoverMenuSeparator,
  PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import type UniboxEmail from "@/lib/api/models/app/unibox/UniboxEmail";
import { useAppStore } from "@/stores";
import { useResourceViewers } from "@/hooks/PresenceProvider";
import type { ConversationActions } from "@/hooks/useConversationActions";
import { SNOOZE_PRESETS } from "@/lib/unibox/snooze";
import { cn } from "@/lib/utils";
import { nameFromAddr } from "@/lib/helper/emailAddress";

function relative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `${m} דק'`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ש'`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} ימ'`;
  return d.toLocaleDateString("he-IL", { month: "short", day: "numeric" });
}

function fromName(s: string): string {
  if (!s) return "שולח לא ידוע";
  return nameFromAddr(s);
}

interface ConversationItemProps {
  email: UniboxEmail;
  selected?: boolean;
  selecting?: boolean;
  onToggleSelect?: (threadId: string, checked: boolean, shiftKey: boolean) => void;
  scope?: string;
  actions: ConversationActions;
}

export function ConversationItem({
  email,
  selected = false,
  selecting = false,
  onToggleSelect,
  scope,
  actions,
}: ConversationItemProps) {
  const selectedThreadId = useAppStore((s) => s.selectedThreadId);
  const setSelectedThreadId = useAppStore((s) => s.setSelectedThreadId);
  const setSelectedAccountId = useAppStore((s) => s.setSelectedAccountId);
  const accounts = useAppStore((s) => s.emails);

  const threadId = email.thread_id || email.id;
  const isSelected = selectedThreadId === threadId;
  const date = new Date(email.date);
  const unread = !email.is_seen;
  // Snippets are plain text; slice by code point so an emoji at the cut never
  // splits into a replacement character.
  const preview = [...(email.snippet ?? "").replace(/\s+/g, " ")]
    .slice(0, 140)
    .join("");

  const mailbox = accounts.find((a) => a.id === email.account_id);
  const showMailbox = !!mailbox && accounts.length > 1;
  const sender = fromName(email.from);

  const messageCount = email.message_count ?? 1;
  const labels = email.labels ?? [];

  // A teammate already has this conversation open (or is replying):
  // surface it on the row so nobody double-handles the same email.
  const viewers = useResourceViewers(`thread:${threadId}`);
  const replierName = viewers.find((v) => v.action === "replying")?.name;

  return (
    <div
      role="row"
      aria-selected={selected}
      tabIndex={-1}
      onClick={() => {
        setSelectedThreadId(threadId);
        setSelectedAccountId(email.account_id ?? null);
      }}
      className={cn(
        "group relative w-full text-right pr-3 pl-4 py-2.5 flex items-start gap-2 transition-colors cursor-pointer select-none",
        isSelected
          ? "bg-sky-50"
          : selected
            ? "bg-slate-50/80"
            : "hover:bg-slate-50",
      )}
    >
      {/* Gutter: checkbox on hover or in select mode, unread dot when unread */}
      <span className="w-3.5 shrink-0 flex items-center justify-center h-[18px]">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            aria-label={`בחר שיחה מאת ${sender}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(threadId, e.currentTarget.checked, e.shiftKey);
            }}
            onChange={() => {}}
            className={cn(
              "w-3.5 h-3.5 rounded accent-sky-600 cursor-pointer",
              selected || selecting
                ? "block"
                : "hidden md:group-hover:block md:group-focus-within:block",
            )}
          />
        )}
        {unread && !selected && (
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full bg-sky-500",
              selecting ? "hidden" : "block md:group-hover:hidden md:group-focus-within:hidden",
            )}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0 h-[18px]">
          <span
            className={cn(
              "text-[12.5px] truncate min-w-0",
              unread ? "text-slate-900 font-semibold" : "text-slate-700",
            )}
          >
            {sender}
          </span>
          {messageCount > 1 && (
            <span
              className="shrink-0 tabular-nums text-[11px] text-slate-400"
              title={`${messageCount} הודעות בשיחה זו`}
            >
              {messageCount}
            </span>
          )}
          {viewers.length > 0 && (
            <span
              className="shrink-0 relative flex size-2"
              title={
                replierName
                  ? `${replierName} משיב/ה כעת`
                  : `${viewers[0].name ?? "חבר צוות"} צופה כעת`
              }
            >
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                  replierName ? "bg-amber-400" : "bg-emerald-400",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex size-2 rounded-full",
                  replierName ? "bg-amber-500" : "bg-emerald-500",
                )}
              />
            </span>
          )}
          <span
            className={cn(
              "text-[11px] tabular-nums shrink-0 mr-auto",
              "md:group-hover:invisible md:group-focus-within:invisible",
              unread ? "text-sky-700 font-medium" : "text-slate-400",
            )}
          >
            {relative(date)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
          <span
            className={cn(
              "text-[12.5px] truncate min-w-0",
              unread ? "text-slate-900 font-medium" : "text-slate-600",
            )}
          >
            {email.subject || ("(ללא נושא)")}
          </span>
          {labels.length > 0 && (
            <span className="mr-auto shrink-0 inline-flex items-center gap-1">
              {labels.slice(0, 2).map((l) => (
                <LabelChip key={l.id} title={l.title} color={l.color} />
              ))}
              {labels.length > 2 && (
                <span
                  className="text-[10px] text-slate-400 tabular-nums"
                  title={labels
                    .slice(2)
                    .map((l) => l.title)
                    .join(", ")}
                >
                  +{labels.length - 2}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0 mt-0.5">
          <span className="text-[11.5px] text-slate-400 truncate min-w-0">
            {preview || ("(אין תצוגה מקדימה)")}
          </span>
          {showMailbox && (
            <span
              className="mr-auto shrink-0 max-w-[40%] truncate text-[10.5px] text-slate-300 group-hover:text-slate-400 transition-colors"
              title={mailbox.email}
            >
              {mailbox.email}
            </span>
          )}
        </div>
      </div>

      <RowActions
        threadId={threadId}
        unread={unread}
        scope={scope}
        actions={actions}
      />
    </div>
  );
}

// The row's own triage controls: Archive inline, everything else one click
// deeper. Shown on hover from md up and always on touch, where there is no
// hover to reveal them with.
function RowActions({
  threadId,
  unread,
  scope,
  actions,
}: {
  threadId: string;
  unread: boolean;
  scope?: string;
  actions: ConversationActions;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [snoozeMode, setSnoozeMode] = React.useState(false);

  const filed = scope === "archive" || scope === "trash";
  const snoozedScope = scope === "snoozed";

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={stop}
      className={cn(
        "absolute left-2 top-1.5 flex items-center gap-0.5 rounded-md bg-inherit",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
      )}
    >
      <RowButton
        label={filed ? "העבר לדואר נכנס" : "ארכיון"}
        onClick={() => actions.file([threadId], filed ? "inbox" : "archive")}
        disabled={actions.filing}
        // Touch gets the menu only: two always-on buttons would crowd the row
        // at the width a phone has.
        className="hidden md:inline-flex"
      >
        {filed ? (
          <InboxIcon className="w-3.5 h-3.5" />
        ) : (
          <ArchiveIcon className="w-3.5 h-3.5" />
        )}
      </RowButton>

      <PopoverMenu
        align="start"
        open={menuOpen}
        onOpenChange={(o) => {
          setMenuOpen(o);
          if (!o) setSnoozeMode(false);
        }}
      >
        <PopoverMenuTrigger asChild>
          <button
            type="button"
            aria-label="פעולות על שיחה"
            className="size-6 rounded inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          >
            <MoreHorizontalIcon className="w-3.5 h-3.5" />
          </button>
        </PopoverMenuTrigger>
        <PopoverMenuContent>
          <AnimatePresence mode="wait" initial={false}>
            {snoozeMode ? (
              <motion.div
                key="snooze"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <PopoverMenuLabel>השהה עד</PopoverMenuLabel>
                {SNOOZE_PRESETS.map((p) => (
                  <PopoverMenuItem
                    key={p.label}
                    onSelect={() => actions.snooze([threadId], p.until())}
                  >
                    {p.label}
                  </PopoverMenuItem>
                ))}
                <PopoverMenuSeparator />
                <PopoverMenuItem
                  onSelect={() => setSnoozeMode(false)}
                  closeOnSelect={false}
                >
                  חזרה
                </PopoverMenuItem>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <PopoverMenuItem
                  icon={
                    unread ? (
                      <MailOpenIcon className="w-3.5 h-3.5" />
                    ) : (
                      <MailCheckIcon className="w-3.5 h-3.5" />
                    )
                  }
                  onSelect={() => actions.setSeen([threadId], unread)}
                >
                  {unread ? "סמן כנקרא" : "סמן כלא נקרא"}
                </PopoverMenuItem>
                {snoozedScope ? (
                  <PopoverMenuItem
                    icon={<MoonIcon className="w-3.5 h-3.5" />}
                    onSelect={() => actions.unsnooze([threadId])}
                  >
                    בטל השהיה כעת
                  </PopoverMenuItem>
                ) : (
                  <PopoverMenuItem
                    icon={<MoonIcon className="w-3.5 h-3.5" />}
                    onSelect={() => setSnoozeMode(true)}
                    closeOnSelect={false}
                  >
                    השהה…
                  </PopoverMenuItem>
                )}
                <PopoverMenuSeparator />
                {filed ? (
                  <PopoverMenuItem
                    icon={<InboxIcon className="w-3.5 h-3.5" />}
                    disabled={actions.filing}
                    onSelect={() => actions.file([threadId], "inbox")}
                  >
                    העבר לדואר נכנס
                  </PopoverMenuItem>
                ) : (
                  <PopoverMenuItem
                    icon={<ArchiveIcon className="w-3.5 h-3.5" />}
                    disabled={actions.filing}
                    onSelect={() => actions.file([threadId], "archive")}
                  >
                    ארכיון
                  </PopoverMenuItem>
                )}
                {scope !== "trash" && (
                  <PopoverMenuItem
                    danger
                    icon={<TrashIcon className="w-3.5 h-3.5" />}
                    disabled={actions.filing}
                    onSelect={() => actions.file([threadId], "trash")}
                  >
                    העבר לאשפה
                  </PopoverMenuItem>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverMenuContent>
      </PopoverMenu>
    </div>
  );
}

function RowButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "size-6 rounded inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-50 transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}

function LabelChip({ title, color }: { title: string; color: string }) {
  // The dot carries the colour, the chip carries the name; a solid coloured
  // chip is too loud for a list this dense.
  return (
    <span
      className="inline-flex items-center gap-1 h-4 px-1.5 rounded-sm text-[10px] font-medium overflow-hidden max-w-[110px]"
      style={{
        color: color || "#475569",
        backgroundColor: color ? `${color}14` : "rgb(241 245 249)",
      }}
      title={title}
    >
      <span
        aria-hidden
        className="block size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color || "#94a3b8" }}
      />
      <span className="truncate">{title}</span>
    </span>
  );
}
