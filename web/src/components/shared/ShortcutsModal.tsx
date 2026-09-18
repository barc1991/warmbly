import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/stores'
import {
  shortcutGroupTitles,
  visibleShortcuts,
  type ShortcutGroupId,
  type ShortcutRow,
} from '@/hooks/useKeyboardShortcuts'

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

const hebrewGroupTitles: Record<ShortcutGroupId, string> = {
  navigation: 'ניווט',
  list: 'ניווט ברשימות',
  actions: 'פעולות',
  assistant: 'עוזר AI',
}

const hebrewDescriptions: Record<string, string> = {
  'Go to Email Accounts': 'מעבר לתיבות דואר',
  'Go to Contacts': 'מעבר לאנשי קשר',
  'Go to Campaigns': 'מעבר לקמפיינים',
  'Go to Unibox': 'מעבר לתיבת דואר מאוחדת (Unibox)',
  'Go to Analytics': 'מעבר לאנליטיקה',
  'Go to Pipelines': 'מעבר לצינורות מכירה',
  'Go to Deals': 'מעבר לעסקאות',
  'Go to Tasks': 'מעבר למשימות',
  'Go to Templates': 'מעבר לתבניות',
  'Go to API Keys': 'מעבר למפתחות API',
  'Go to Settings': 'מעבר להגדרות',
  'Move down in list': 'ירידה שורה ברשימה',
  'Move up in list': 'עלייה שורה ברשימה',
  'Go to first item': 'מעבר לפריט הראשון',
  'Go to last item': 'מעבר לפריט האחרון',
  'Open selected item': 'פתיחת הפריט הנבחר',
  'Close modal / Deselect': 'סגירת חלון / ביטול בחירה',
  'Select/deselect item': 'בחירה או ביטול בחירה של פריט',
  'Focus search': 'התמקדות בשורת החיפוש',
  'Compose a new email': 'חיבור אימייל חדש',
  'Edit selected item': 'עריכת הפריט הנבחר',
  'Toggle sidebar': 'הצגה או הסתרת סרגל צד',
  'Show shortcuts': 'הצגת קיצורי מקשים',
  'Command palette': 'לוח פקודות וחיפוש',
  'Open / close the assistant': 'פתיחה או סגירת עוזר ה-AI',
  'Next conversation tab': 'לשונית השיחה הבאה',
  'Previous conversation tab': 'לשונית השיחה הקודמת',
  'New chat': 'שיחה חדשה',
  'Close tab': 'סגירת לשונית',
  'Minimize to dock': 'מזעור לפס התחתון',
  'Pop out / dock the panel': 'הצמדה או הצפת הפאנל',
  'Close the panel': 'סגירת הפאנל',
}

function ShortcutRowView({ keys, description }: ShortcutRow) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{hebrewDescriptions[description] ?? description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            <KeyboardKey>{key}</KeyboardKey>
            {i < keys.length - 1 && <span className="text-muted-foreground">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

// A group with nothing live on this screen renders nothing. Every row below is
// one the dispatcher will actually run right now.
function ShortcutGroup({ group }: { group: ShortcutGroupId }) {
  const rows = visibleShortcuts(group)
  if (rows.length === 0) return null

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {hebrewGroupTitles[group] ?? shortcutGroupTitles[group]}
      </h3>
      <div className="divide-y divide-border">
        {rows.map((row, i) => (
          <ShortcutRowView key={i} {...row} />
        ))}
      </div>
    </div>
  )
}

export function ShortcutsModal() {
  const open = useAppStore((state) => state.shortcutsModalOpen)
  const setOpen = useAppStore((state) => state.setShortcutsModalOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>קיצורי מקלדת</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <ShortcutGroup group="navigation" />
          </div>
          <div className="space-y-6">
            <ShortcutGroup group="list" />
            <ShortcutGroup group="actions" />
            <ShortcutGroup group="assistant" />
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          לחץ <KeyboardKey>?</KeyboardKey> בכל עת להצגת חלון זה
        </div>
      </DialogContent>
    </Dialog>
  )
}
