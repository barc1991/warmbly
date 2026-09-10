import { useTranslation } from 'react-i18next'
import { useConnectionStatus } from '@/stores'
import { cn } from '@/lib/utils'

export function ConnectionIndicator() {
  const { status, quality } = useConnectionStatus()
  const { i18n } = useTranslation()
  const isHe = i18n.language === 'he'

  return (
    <div
      className="flex items-center gap-2"
      title={
        isHe
          ? status === 'connected'
            ? 'חיבור פעיל בזמן אמת'
            : status === 'connecting'
              ? 'מתחבר מחדש...'
              : 'מנותק'
          : status === 'connected'
            ? 'Connected in real-time'
            : status
      }
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          status === 'connected' && quality === 'good' && 'bg-emerald-500 animate-pulse',
          status === 'connected' && quality === 'degraded' && 'bg-amber-500',
          status === 'connected' && quality === 'poor' && 'bg-red-500',
          status === 'connecting' && 'bg-amber-500',
          status === 'disconnected' && 'bg-red-500',
        )}
      />
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {status === 'connected' && quality === 'good' && (isHe ? 'פעיל' : 'Live')}
        {status === 'connecting' && (isHe ? 'מתחבר מחדש...' : 'Reconnecting...')}
        {status === 'disconnected' && (isHe ? 'מנותק' : 'Disconnected')}
        {status === 'connected' && quality === 'degraded' && (isHe ? 'חיבור איטי' : 'Slow connection')}
        {status === 'connected' && quality === 'poor' && (isHe ? 'חיבור חלש' : 'Poor connection')}
      </span>
    </div>
  )
}

