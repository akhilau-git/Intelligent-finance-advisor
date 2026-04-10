'use client'

import { UserButton } from '@clerk/nextjs'
import { Bell, AlertTriangle, Search, Zap, Settings, Shield, Check, Info } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="topbarGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5D67A" />
          <stop offset="50%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#D4891A" />
        </linearGradient>
      </defs>
      <path d="M1 14 Q14 2 27 14 Q14 26 1 14Z" fill="none" stroke="url(#topbarGold)" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="7" fill="none" stroke="url(#topbarGold)" strokeWidth="1.2" />
      <rect x="10" y="15" width="2.5" height="4" rx=".5" fill="url(#topbarGold)" />
      <rect x="13" y="11" width="2.5" height="8" rx=".5" fill="url(#topbarGold)" />
      <rect x="16" y="13" width="2.5" height="6" rx=".5" fill="url(#topbarGold)" />
    </svg>
  )
}

export default function TopBar() {
  const [time, setTime] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDateStr(now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }))
    }
    tick()
    const id = setInterval(tick, 1000)

    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      clearInterval(id)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const notifications = [
    { title: 'New Claim Submitted', time: '2m ago', desc: 'Travel expense for Client Meeting', type: 'info', icon: Zap },
    { title: 'AI Verification Success', time: '15m ago', desc: '5 claims validated with zero flags', type: 'success', icon: Check },
    { title: 'High Risk Flag', time: '1h ago', desc: 'Suspicious vendor detected in Office supplies', type: 'warning', icon: AlertTriangle },
  ]

  return (
    <header style={{
      height: 52,
      background: 'rgba(8,12,31,0.95)',
      borderBottom: '1px solid rgba(139,92,246,0.12)',
      display: 'flex', alignItems: 'center',
      padding: '0 18px', gap: 14, flexShrink: 0,
      backdropFilter: 'blur(20px)',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26,
          background: 'rgba(245,166,35,0.08)',
          border: '1px solid rgba(245,166,35,0.25)',
          borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Logo />
        </div>
        <div>
          <p style={{
            fontWeight: 900, fontSize: 13, letterSpacing: '-0.01em', lineHeight: 1,
            background: 'linear-gradient(135deg, #F5D67A 0%, #F5A623 60%, #D4891A 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>FinSight</p>
          <p style={{ fontSize: 8, color: 'rgba(167,139,250,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1, fontWeight: 700 }}>
            INTEGRITY AT EVERY TRANSACTION
          </p>
        </div>
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(139,92,246,0.2)', flexShrink: 0 }} />

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
        <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(75,82,128,0.8)' }} />
        <input
          placeholder="Search claims, reports, or policies..."
          style={{
            width: '100%', background: 'rgba(5,7,20,0.6)',
            border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8,
            padding: '6px 10px 6px 28px', fontSize: 11,
            color: 'rgba(156,163,192,0.8)', outline: 'none', fontFamily: 'inherit',
            transition: 'border-color .15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(139,92,246,0.15)')}
        />
      </div>

      {/* Clock */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#F0F2FF', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{time}</p>
        <p style={{ fontSize: 9, color: 'rgba(75,82,128,0.8)', marginTop: 2 }}>{dateStr}</p>
      </div>

      {/* Alerts & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative' }}>
        {[Bell, Settings, Shield].map((Icon, i) => (
          <div 
            key={i} 
            onClick={() => i === 0 && setShowNotifications(!showNotifications)}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: showNotifications && i === 0 ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)', 
              border: showNotifications && i === 0 ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(139,92,246,0.15)',
              borderRadius: 7, cursor: 'pointer', position: 'relative',
              transition: 'all .12s',
            }}
          >
            <Icon size={13} style={{ color: i === 0 ? 'rgba(167,139,250,0.7)' : 'rgba(245,158,11,0.7)' }} />
            {i === 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: '#EF4444', border: '1px solid rgba(8,12,31,.8)' }} />
            )}
          </div>
        ))}

        {/* Notification Dropdown */}
        {showNotifications && (
          <div 
            ref={notificationRef}
            style={{
              position: 'absolute', top: 42, right: 40, width: 280,
              background: 'rgba(13,18,48,0.95)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100,
              animation: 'slideIn 0.2s ease-out', overflow: 'hidden'
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(139,92,246,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#F0F2FF' }}>Notifications</p>
              <span style={{ fontSize: 9, background: 'rgba(139,92,246,0.2)', color: '#A78BFA', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>3 NEW</span>
            </div>
            
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {notifications.map((n, idx) => (
                <div key={idx} style={{ 
                  padding: '12px 14px', borderBottom: idx < notifications.length - 1 ? '1px solid rgba(139,92,246,0.05)' : 'none',
                  cursor: 'pointer', transition: 'background .1s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ 
                      width: 24, height: 24, borderRadius: 6, background: n.type === 'warning' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <n.icon size={12} style={{ color: n.type === 'warning' ? '#EF4444' : '#10B981' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#F0F2FF' }}>{n.title}</p>
                        <span style={{ fontSize: 9, color: 'rgba(156,163,192,0.5)' }}>{n.time}</span>
                      </div>
                      <p style={{ fontSize: 10, color: 'rgba(156,163,192,0.7)', marginTop: 2, lineHeight: 1.4 }}>{n.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 10, background: 'rgba(255,255,255,0.02)', textAlign: 'center', borderTop: '1px solid rgba(139,92,246,0.1)' }}>
              <button style={{ 
                background: 'none', border: 'none', color: '#A78BFA', fontSize: 10, fontWeight: 700, cursor: 'pointer' 
              }}>VIEW ALL NOTIFICATIONS</button>
            </div>
          </div>
        )}

        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  )
}
