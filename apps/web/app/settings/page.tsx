'use client'

import { useUser } from '@clerk/nextjs'
import { Settings, User, Shield, Bell } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useUser()

  return (
    <div className="fade-in" style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Manage your account and preferences</p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <User size={15} style={{ color: '#A78BFA' }} />
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Profile</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: 'rgba(8,12,31,0.5)', borderRadius: 12, border: '1px solid rgba(139,92,246,0.1)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(139,92,246,0.3),rgba(245,166,35,0.2))', border: '2px solid rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#A78BFA' }}>{(user?.firstName?.[0] || 'U').toUpperCase()}</span>
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#F0F2FF' }}>{user?.fullName || 'User'}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.emailAddresses[0]?.emailAddress}</p>
            <p style={{ fontSize: 10, color: '#A78BFA', marginTop: 4, fontWeight: 700, textTransform: 'capitalize' }}>
              Role: {(user?.publicMetadata?.role as string) || 'Employee'}
            </p>
          </div>
        </div>
      </div>

      {[
        { icon: Shield, label: 'Security', items: ['Two-factor authentication: Managed by Clerk', 'Session management: Active', 'Password policy: Enterprise grade'] },
        { icon: Bell,   label: 'Notifications', items: ['Claim status updates: Enabled', 'Fraud alerts: Enabled', 'Weekly reports: Enabled'] },
      ].map(section => {
        const Icon = section.icon
        return (
          <div key={section.label} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Icon size={15} style={{ color: '#A78BFA' }} />
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{section.label}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.items.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(8,12,31,0.5)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.1)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.split(':')[0]}</span>
                  <span style={{ fontSize: 12, color: '#34D399', fontWeight: 700 }}>{item.split(':')[1]?.trim()}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
