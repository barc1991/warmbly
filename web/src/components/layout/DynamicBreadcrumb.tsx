import { useLocation } from 'react-router-dom'
import { Fragment } from 'react'
import { labelMap } from '@/hooks/useHeaderBreadcrumbs'

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
        const key = segment.toLowerCase()
        const normalizedKey = key.replaceAll('-', '_')
        const words = segment.replaceAll('-', ' ').replaceAll('_', ' ')
        const label =
          labelMap[segment] ??
          labelMap[key] ??
          labelMap[normalizedKey] ??
          labelMap[key.replaceAll('_', '-')] ??
          words.charAt(0).toUpperCase() + words.slice(1)

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
