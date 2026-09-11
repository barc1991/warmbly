import { useLocation } from 'react-router-dom'
import { Fragment } from 'react'

const labelMap: Record<string, string> = {
  app: 'לוח בקרה',
  emails: 'תיבות דואר',
  contacts: 'אנשי קשר',
  segments: 'סגמנטים',
  categories: 'קטגוריות',
  campaigns: 'קמפיינים',
  unibox: 'תיבת דואר נכנס',
  analytics: 'אנליטיקה',
  crm: 'CRM',
  pipelines: 'משפכים',
  deals: 'עסקאות',
  tasks: 'משימות',
  templates: 'תבניות',
  'api-keys': 'מפתחות API',
  settings: 'הגדרות',
  billing: 'חיוב ומנויים',
  team: 'צוות',
  leads: 'לידים',
  preferences: 'העדפות',
  schedule: 'לוח זמנים',
  steps: 'שלבים',
}

export function DynamicBreadcrumb() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const breadcrumbSegments = segments.filter((s) => s !== 'app')

  if (breadcrumbSegments.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-zinc-900">לוח בקרה</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-sm min-w-0">
      {breadcrumbSegments.map((segment, index) => {
        const isLast = index === breadcrumbSegments.length - 1
        const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

        return (
          <Fragment key={segment + index}>
            {index > 0 && <span className="text-zinc-300">/</span>}
            {isLast ? (
              <span className="font-medium text-zinc-900 truncate">{label}</span>
            ) : (
              <span className="text-zinc-400 truncate">{label}</span>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
