import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function fraudColor(score: number) {
  if (score < 0.2) return 'var(--green)'
  if (score < 0.5) return 'var(--amber)'
  return 'var(--red)'
}

export function authStyle(score: string): React.CSSProperties {
  const m: Record<string, React.CSSProperties> = {
    green:  { background: 'rgba(16,185,129,0.12)', color: '#34D399' },
    yellow: { background: 'rgba(245,158,11,0.12)',  color: '#FCD34D' },
    red:    { background: 'rgba(239,68,68,0.12)',   color: '#FCA5A5' },
  }
  return m[score] ?? { background: 'rgba(75,82,128,0.12)', color: '#9CA3C8' }
}
