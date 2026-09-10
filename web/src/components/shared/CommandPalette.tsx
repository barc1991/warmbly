import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  MailIcon,
  UsersIcon,
  MegaphoneIcon,
  InboxIcon,
  BarChart3Icon,
  GitBranchIcon,
  CircleDollarSignIcon,
  CheckSquareIcon,
  FileTextIcon,
  KeyIcon,
  SettingsIcon,
  CreditCardIcon,
  ClipboardListIcon,
  ZapIcon,
  ShieldCheckIcon,
  CableIcon,
  CalendarClockIcon,
  ListChecksIcon,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useAppStore } from '@/stores'

interface NavCommandItem {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  englishLabel: string
  keywords: string
  shortcut?: string
  onSelect: () => void
}

export function CommandPalette() {
  const { t } = useTranslation(['nav', 'common'])
  const navigate = useNavigate()
  const open = useAppStore((state) => state.commandPaletteOpen)
  const setOpen = useAppStore((state) => state.setCommandPaletteOpen)
  const setShortcutsModalOpen = useAppStore((state) => state.setShortcutsModalOpen)

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  const navigationCommands: NavCommandItem[] = [
    {
      id: 'emails',
      icon: MailIcon,
      label: t('nav:items.mailboxes', 'Mailboxes'),
      englishLabel: 'Email Accounts Mailboxes',
      keywords: 'email mailboxes accounts חשבונות אימייל תיבות דואר שליחה',
      shortcut: 'g e',
      onSelect: () => navigate('/app/emails'),
    },
    {
      id: 'contacts',
      icon: UsersIcon,
      label: t('nav:items.contacts', 'Contacts'),
      englishLabel: 'Contacts',
      keywords: 'contacts leads אנשי קשר לידים לקוחות רשימות תפוצה',
      shortcut: 'g c',
      onSelect: () => navigate('/app/contacts'),
    },
    {
      id: 'campaigns',
      icon: MegaphoneIcon,
      label: t('nav:items.campaigns', 'Campaigns'),
      englishLabel: 'Campaigns',
      keywords: 'campaigns outreach קמפיינים שליחות קמפיין תפוצה',
      shortcut: 'g m',
      onSelect: () => navigate('/app/campaigns'),
    },
    {
      id: 'unibox',
      icon: InboxIcon,
      label: t('nav:items.unibox', 'Unibox'),
      englishLabel: 'Unibox Inbox Messages',
      keywords: 'unibox inbox mail messages יוניבוקס תיבת דואר מאוחדת דואר נכנס הודעות שיחות',
      shortcut: 'g u',
      onSelect: () => navigate('/app/unibox'),
    },
    {
      id: 'analytics',
      icon: BarChart3Icon,
      label: t('nav:items.analytics', 'Analytics'),
      englishLabel: 'Analytics Stats Reporting',
      keywords: 'analytics stats reports אנליטיקה דוחות סטטיסטיקה ביצועים נתונים',
      shortcut: 'g a',
      onSelect: () => navigate('/app/analytics'),
    },
    {
      id: 'deliverability',
      icon: ShieldCheckIcon,
      label: t('nav:items.deliverability', 'Deliverability'),
      englishLabel: 'Deliverability Warmup Spam',
      keywords: 'deliverability warmup עבירות חימום תיבות ספאם spf dkim dmarc dns',
      onSelect: () => navigate('/app/deliverability'),
    },
    {
      id: 'pipelines',
      icon: GitBranchIcon,
      label: t('nav:items.pipelines', 'Pipelines'),
      englishLabel: 'Pipelines CRM',
      keywords: 'pipelines deals crm צינורות מכירה שלבים פייפליין משפך',
      shortcut: 'g p',
      onSelect: () => navigate('/app/crm/pipelines'),
    },
    {
      id: 'deals',
      icon: CircleDollarSignIcon,
      label: t('nav:items.deals', 'Deals'),
      englishLabel: 'Deals Opportunities',
      keywords: 'deals sales crm עסקאות מכירות הזדמנויות כסף שווי',
      shortcut: 'g d',
      onSelect: () => navigate('/app/crm/deals'),
    },
    {
      id: 'tasks',
      icon: CheckSquareIcon,
      label: t('nav:items.tasks', 'Tasks'),
      englishLabel: 'Tasks Todo',
      keywords: 'tasks todo reminders משימות תזכורות לביצוע מטלות',
      shortcut: 'g t',
      onSelect: () => navigate('/app/crm/tasks'),
    },
    {
      id: 'meetings',
      icon: CalendarClockIcon,
      label: t('nav:items.meetings', 'Meetings'),
      englishLabel: 'Meetings Calendar',
      keywords: 'meetings calendar schedule פגישות יומן שיחות פגישה',
      onSelect: () => navigate('/app/crm/meetings'),
    },
    {
      id: 'forms',
      icon: ClipboardListIcon,
      label: t('nav:items.forms', 'Forms'),
      englishLabel: 'Forms Lead Capture',
      keywords: 'forms leads טפסים דפי נחיתה איסוף לידים שאלונים',
      onSelect: () => navigate('/app/forms'),
    },
    {
      id: 'templates',
      icon: FileTextIcon,
      label: t('nav:items.templates', 'Templates'),
      englishLabel: 'Templates Email Templates',
      keywords: 'templates email תבניות נוסח הודעות מייל תבנית',
      shortcut: 'g l',
      onSelect: () => navigate('/app/templates'),
    },
    {
      id: 'automations',
      icon: ZapIcon,
      label: t('nav:items.automations', 'Automations'),
      englishLabel: 'Automations Workflows Flows',
      keywords: 'automations workflows flows אוטומציות זרימות תהליכים טריגרים',
      onSelect: () => navigate('/app/automations'),
    },
    {
      id: 'integrations',
      icon: CableIcon,
      label: t('nav:items.integrations', 'Integrations'),
      englishLabel: 'Integrations Webhooks',
      keywords: 'integrations webhooks connect אינטגרציות חיבורים וובהוקס zapier hubspot webhook',
      onSelect: () => navigate('/app/integrations'),
    },
    {
      id: 'api-keys',
      icon: KeyIcon,
      label: t('nav:items.apiKeys', 'API Keys'),
      englishLabel: 'API Keys Developer',
      keywords: 'api keys tokens developer מפתחות טוקנים מפתח גישה פיתוח',
      shortcut: 'g k',
      onSelect: () => navigate('/app/api-keys'),
    },
    {
      id: 'audit',
      icon: ListChecksIcon,
      label: t('nav:items.auditLog', 'Audit Log'),
      englishLabel: 'Audit Log Security History',
      keywords: 'audit log security history יומן פעולות מעקב אבטחה היסטוריה לוג',
      onSelect: () => navigate('/app/audit'),
    },
    {
      id: 'settings',
      icon: SettingsIcon,
      label: t('nav:items.settings', 'Settings'),
      englishLabel: 'Settings Workspace',
      keywords: 'settings workspace הגדרות סביבת עבודה ארגון כללי',
      shortcut: 'g s',
      onSelect: () => navigate('/app/settings'),
    },
    {
      id: 'billing',
      icon: CreditCardIcon,
      label: t('nav:userNav.billing', 'Billing'),
      englishLabel: 'Billing Plans Subscription',
      keywords: 'billing plans subscription תשלום חיוב מנוי שדרוג אשראי תוכנית',
      onSelect: () => navigate('/app/settings/billing'),
    },
  ]

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('nav:commandPalette.title', 'Command Palette')}
      description={t('nav:commandPalette.description', 'Search for a command or page...')}
      // Anchor near the top on phones so the soft keyboard (opened by the
      // autofocused input) doesn't cover the results; md+ keeps the exact
      // default centered placement.
      className="top-[10%] translate-y-0 md:top-[50%] md:translate-y-[-50%]"
    >
      <CommandInput placeholder={t('nav:commandPalette.placeholder', 'Type a command or search...')} />
      <CommandList>
        <CommandEmpty>{t('nav:commandPalette.noResults', 'No results found.')}</CommandEmpty>

        <CommandGroup heading={t('nav:commandPalette.navigation', 'Navigation')}>
          {navigationCommands.map((command) => (
            <CommandItem
              key={command.id}
              value={`${command.label} ${command.englishLabel} ${command.keywords}`}
              onSelect={() => runCommand(command.onSelect)}
              className="flex items-center gap-2.5 cursor-pointer py-2 px-2.5"
            >
              <command.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium text-[13px]">{command.label}</span>
              {command.shortcut && (
                <span className="ms-auto shrink-0 text-xs text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
                  {command.shortcut}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('nav:commandPalette.actions', 'Actions')}>
          <CommandItem
            value={`${t('nav:commandPalette.shortcuts', 'Keyboard shortcuts')} keyboard shortcuts קיצורי מקשים ?`}
            onSelect={() => runCommand(() => setShortcutsModalOpen(true))}
            className="flex items-center gap-2.5 cursor-pointer py-2 px-2.5"
          >
            <KeyIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-[13px]">
              {t('nav:commandPalette.shortcuts', 'Keyboard shortcuts')}
            </span>
            <span className="ms-auto shrink-0 text-xs text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
              ?
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
