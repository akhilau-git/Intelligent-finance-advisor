import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import UserSync from '@/components/auth/UserSync'
import CopilotWidget from '@/components/copilot/CopilotWidget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative' }}>
      {/* Ambient background glow */}
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(76,29,149,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', zIndex: 1 }}>
        <TopBar />

        {/* Summary stats bar (matching the "Total Claims: 128 | Verified: 95 | Flagged: 12" bar) */}
        <div style={{
          background: 'rgba(13,18,48,0.6)',
          borderBottom: '1px solid rgba(139,92,246,0.12)',
          padding: '6px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexShrink: 0,
          backdropFilter: 'blur(10px)',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(167,139,250,0.7)', fontWeight: 600 }}>
            Total Claims: <span style={{ color: '#F0F2FF', fontWeight: 800 }}>—</span>
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(139,92,246,0.2)' }} />
          <span style={{ fontSize: 11, color: 'rgba(52,211,153,0.8)', fontWeight: 600 }}>
            ✓ Verified: <span style={{ color: '#34D399', fontWeight: 800 }}>—</span>
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(139,92,246,0.2)' }} />
          <span style={{ fontSize: 11, color: 'rgba(252,165,165,0.8)', fontWeight: 600 }}>
            ✗ Flagged: <span style={{ color: '#FCA5A5', fontWeight: 800 }}>—</span>
          </span>
        </div>

        <main style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {children}
        </main>

        {/* Footer compliance bar */}
        <div style={{
          borderTop: '1px solid rgba(139,92,246,0.1)',
          padding: '6px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(8,12,31,0.95)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(167,139,250,0.4)', textTransform: 'uppercase' }}>
            FINSIGHT IFOS V1.0.0
          </span>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {['ISO 27001','SOC 2 TYPE II','GDPR','PCI DSS'].map(b => (
              <span key={b} style={{ fontSize: 9, color: 'rgba(75,82,128,0.7)', fontWeight: 700, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(139,92,246,0.5)', display: 'inline-block' }} />
                {b}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(75,82,128,0.7)', fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5A623', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
              END-TO-END ENCRYPTED
            </span>
          </div>
        </div>
      </div>

      <UserSync />
      <CopilotWidget />

      <style>{`@keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}
