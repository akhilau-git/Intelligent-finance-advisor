'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import {
  LayoutDashboard, FileText, PlusCircle, CheckSquare,
  Shield, BarChart3, FileCheck, Settings, LogOut, ChevronRight, Zap,
} from 'lucide-react'

const NAV = [
  {
    items: [
      { href: '/dashboard',  label: 'Dashboard Overview', icon: LayoutDashboard, roles: ['employee','manager','auditor','cfo','admin'] },
      { href: '/claims',     label: 'My Claims',           icon: FileText,         roles: ['employee','manager','auditor','cfo','admin'] },
      { href: '/claims/new', label: 'Submit Claim',        icon: PlusCircle,       roles: ['employee','manager','admin'] },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/compliance', label: 'Compliance Reports', icon: FileCheck, roles: ['auditor','cfo','admin','manager'] },
      { href: '/settings',   label: 'Settings',            icon: Settings,  roles: ['employee','manager','auditor','cfo','admin'] },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/manager', label: 'Approvals',  icon: CheckSquare, roles: ['manager','admin'] },
      { href: '/auditor', label: 'Audit Log',   icon: Shield,      roles: ['auditor','admin'] },
      { href: '/cfo',     label: 'Analytics',   icon: BarChart3,   roles: ['cfo','admin'] },
    ],
  },
]

const TIER: Record<string, { label: string; color: string; glow: string }> = {
  bronze:   { label: 'Bronze',   color: '#CD7F32', glow: 'rgba(205,127,50,.3)' },
  silver:   { label: 'Silver',   color: '#9CA3AF', glow: 'rgba(156,163,175,.3)' },
  gold:     { label: 'Gold',     color: '#F5A623', glow: 'rgba(245,166,35,.4)' },
  platinum: { label: 'Platinum', color: '#A78BFA', glow: 'rgba(167,139,250,.4)' },
}

// Gold FinSight logo SVG
function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="sidebarGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5D67A" />
          <stop offset="50%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#D4891A" />
        </linearGradient>
      </defs>
      <path d="M1 14 Q14 2 27 14 Q14 26 1 14Z" fill="none" stroke="url(#sidebarGold)" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="7" fill="none" stroke="url(#sidebarGold)" strokeWidth="1.2" />
      <rect x="10" y="15" width="2.5" height="4" rx=".5" fill="url(#sidebarGold)" />
      <rect x="13" y="11" width="2.5" height="8" rx=".5" fill="url(#sidebarGold)" />
      <rect x="16" y="13" width="2.5" height="6" rx=".5" fill="url(#sidebarGold)" />
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useClerk()
  const role  = (user?.publicMetadata?.role as string) || 'employee'
  const tier  = (user?.publicMetadata?.tier as string) || 'gold'
  const info  = TIER[tier] || TIER.gold

  return (
    <aside style={{
      width: 220,
      background: 'rgba(8,12,31,0.95)',
      borderRight: '1px solid rgba(139,92,246,0.15)',
      display: 'flex', flexDirection: 'column',
      height: '100%', flexShrink: 0,
      backdropFilter: 'blur(20px)',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'rgba(245,166,35,0.08)',
            border: '1px solid rgba(245,166,35,0.3)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(245,166,35,0.15)',
          }}>
            <Logo />
          </div>
          <div>
            <p style={{
              fontWeight: 900, fontSize: 16, letterSpacing: '-0.01em', lineHeight: 1,
              background: 'linear-gradient(135deg, #F5D67A 0%, #F5A623 60%, #D4891A 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>FinSight</p>
            <p style={{ fontSize: 9, color: 'rgba(167,139,250,0.6)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
              {role}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV.map((section, si) => {
          const filtered = section.items.filter(i => i.roles.includes(role))
          if (!filtered.length) return null
          return (
            <div key={si} style={{ marginBottom: 16 }}>
              {section.label && (
                <p style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'rgba(75,82,128,0.8)',
                  padding: '0 10px', marginBottom: 4,
                }}>
                  {section.label}
                </p>
              )}
              {filtered.map(item => {
                const Icon = item.icon
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', borderRadius: 8,
                      background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                      border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      boxShadow: active ? '0 0 12px rgba(139,92,246,0.1)' : 'none',
                    }}>
                      <Icon size={14} style={{ color: active ? '#A78BFA' : 'rgba(75,82,128,0.8)', flexShrink: 0 }} />
                      <span style={{
                        fontSize: 12, fontWeight: active ? 700 : 400, flex: 1,
                        color: active ? '#F0F2FF' : 'rgba(156,163,192,0.8)',
                      }}>
                        {item.label}
                      </span>
                      {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', flexShrink: 0 }} />}
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid rgba(139,92,246,0.12)', padding: '10px 12px' }}>
        {/* Tier */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '5px 10px', marginBottom: 10,
          boxShadow: `0 0 8px ${info.glow}`,
        }}>
          <span style={{ fontSize: 9, color: 'rgba(75,82,128,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: info.color, letterSpacing: '0.04em' }}>
            ● {info.label.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(245,166,35,0.2))',
            border: '1px solid rgba(139,92,246,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#A78BFA' }}>
              {(user?.firstName?.[0] || 'U').toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.fullName || user?.firstName || 'User'}
            </p>
            <p style={{ fontSize: 9, color: 'rgba(75,82,128,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
          <button onClick={() => signOut()} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(75,82,128,0.8)', padding: 4, borderRadius: 4, display: 'flex',
            transition: 'color .12s',
          }} title="Sign out">
            <LogOut size={13} />
          </button>
        </div>

        <p style={{ fontSize: 8, color: 'rgba(75,82,128,0.5)', marginTop: 10, textAlign: 'center', letterSpacing: '0.06em', fontWeight: 600 }}>
          FINSIGHT IFOS V1.0.0
        </p>
      </div>
    </aside>
  )
}
