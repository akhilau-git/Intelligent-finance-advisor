'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { claimsApi, setAuthToken } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { TrendingUp, Shield, CheckCircle2, XCircle, FileText, Clock, AlertTriangle, BarChart3, Zap, ArrowRight, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface Stats { total: number; pending: number; approved: number; rejected: number; total_amount: number; fraud_flags: number }

const CHART_DATA = [
  { name: 'Travel',  amount: 42000, color: '#8B5CF6' },
  { name: 'Meals',   amount: 18000, color: '#A78BFA' },
  { name: 'Office',  amount: 12000, color: '#7C3AED' },
  { name: 'Offic.',  amount: 8000,  color: '#6D28D9' },
  { name: 'Misc',    amount: 5000,  color: '#5B21B6' },
]

function Shimmer({ h = 80, r = 10 }: { h?: number; r?: number }) {
  return <div className="shimmer" style={{ height: h, borderRadius: r }} />
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(13,18,48,0.95)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, color: 'rgba(167,139,250,0.7)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', fontFamily: 'monospace' }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      setAuthToken(token)
      try {
        const [s, c] = await Promise.all([claimsApi.getStats(), claimsApi.list()])
        setStats(s.data)
        setRecent((c.data.claims || []).slice(0, 5))
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [getToken])

  const role = (user?.publicMetadata?.role as string) || 'employee'

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Page header ── */}
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="dashboard-hero" style={{
          background: 'rgba(13,18,48,0.6)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderLeft: '3px solid #8B5CF6',
          borderRadius: 12, padding: '14px 18px', flex: 1, marginRight: 14,
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#F0F2FF', letterSpacing: '-0.02em' }}>Dashboard Overview</h1>
          <p style={{ fontSize: 11, color: 'rgba(156,163,192,0.7)', marginTop: 4 }}>Real-time financial tracking &amp; automated AI audits.</p>
        </div>
        <Link href="/claims/new" className="dashboard-cta-link" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <button className="btn-primary dashboard-cta" style={{ padding: '10px 18px' }}>
            <Zap size={14} /> SUBMIT / FINANCE CLAIM
          </button>
        </Link>
      </div>

      {/* ── Top row: 4 stat cards + AI Fraud ── */}
      <div className="dashboard-top-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 380px', gap: 12 }}>

        {/* Stat card 1 — TOTAL REIMBURSED */}
        <div className="card stat-reimbursed" style={{ padding: 16, gridColumn: '1/3', borderLeft: '2px solid rgba(245,166,35,0.4)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(75,82,128,0.8)' }}>
            TOTAL REIMBURSED
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#F0F2FF', letterSpacing: '-0.03em', fontFamily: 'JetBrains Mono, monospace' }}>
              {loading ? '—' : formatCurrency(stats?.total_amount ?? 0)}
            </p>
            <div style={{ width: 36, height: 36, background: 'rgba(245,166,35,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} style={{ color: '#F5A623' }} />
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>↑ +12.5% this quarter</span>
          </div>
          <div style={{ marginTop: 8, height: 2, background: 'rgba(245,166,35,0.15)', borderRadius: 1 }}>
            <div style={{ width: '55%', height: '100%', background: 'linear-gradient(90deg,#F5A623,#F5D67A)', borderRadius: 1 }} />
          </div>
        </div>

        {/* Stat card 2 — FRAUD FLAGS */}
        <div className="card stat-fraud" style={{ padding: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(75,82,128,0.8)' }}>FRAUD FLAGS</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: stats?.fraud_flags ? '#FCA5A5' : '#F0F2FF', letterSpacing: '-0.03em' }}>
              {loading ? '—' : stats?.fraud_flags ?? 0}
            </p>
            <div style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} style={{ color: '#F59E0B' }} />
            </div>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(75,82,128,0.7)', marginTop: 8 }}>
            {loading ? 'Analyzing risk signals...' : (stats?.fraud_flags ?? 0) === 0 ? 'No suspicious activity' : `${stats?.fraud_flags} flagged`}
          </p>
        </div>

        {/* Stat card 3 — APPROVED */}
        <div className="card stat-approved" style={{ padding: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(75,82,128,0.8)' }}>APPROVED</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#34D399', letterSpacing: '-0.03em' }}>
              {loading ? '—' : stats?.approved ?? 0}
            </p>
            <div style={{ width: 36, height: 36, background: 'rgba(16,185,129,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} style={{ color: '#10B981' }} />
            </div>
          </div>
        </div>

        {/* AI Fraud Analysis panel (right, spans 2 rows) */}
        <div className="card-glow panel-ai" style={{ padding: 18, gridRow: '1/3', gridColumn: '5/6', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#F0F2FF' }}>AI Fraud Analysis</p>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={14} style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F0F2FF', lineHeight: 1.3 }}>
                {loading ? 'Scanning recent claims...' : `${stats?.fraud_flags || 0} Suspicious Claims Detected`}
              </p>
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px' }}>
            Review Alerts
          </button>

          {/* Expense chart */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F0F2FF' }}>Expense Overview</p>
              <span style={{ fontSize: 10, color: 'rgba(167,139,250,0.6)', fontWeight: 600 }}>₹56K MONTH ▾</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={CHART_DATA} barSize={16}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(75,82,128,0.7)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                <Bar dataKey="amount" radius={[3,3,0,0]}>
                  {CHART_DATA.map((entry, index) => (
                    <rect key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Intelligence report */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(245,166,35,0.08))',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#F5A623', background: 'rgba(245,166,35,0.15)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em' }}>⊙ PLATINUM STATUS</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#34D399', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em' }}>✓ AI VERIFIED</span>
            </div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>⚡ Intelligence Report</p>
            <p style={{ fontSize: 13, color: '#F0F2FF', lineHeight: 1.6, fontWeight: 400 }}>
              Your spending is <span style={{ color: '#F5C542', fontWeight: 800 }}>15% lower</span> than the department this quarter.
            </p>
            <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 10, fontSize: 11 }}>
              ⊙ EXPLORE SAVINGS
            </button>
          </div>
        </div>

        {/* Stat card 4 — TOTAL CLAIMS */}
        <div className="card stat-total" style={{ padding: 16, gridColumn: '1/2' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(75,82,128,0.8)' }}>TOTAL CLAIMS</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#F0F2FF', letterSpacing: '-0.03em' }}>
              {loading ? '—' : stats?.total ?? 0}
            </p>
            <div style={{ width: 36, height: 36, background: 'rgba(139,92,246,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} style={{ color: '#A78BFA' }} />
            </div>
          </div>
        </div>

        {/* Stat card 5 — PENDING REVIEW */}
        <div className="card stat-pending" style={{ padding: 16, gridColumn: '2/3' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(75,82,128,0.8)' }}>PENDING REVIEW</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#FCD34D', letterSpacing: '-0.03em' }}>
              {loading ? '—' : stats?.pending ?? 0}
            </p>
            <div style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} style={{ color: '#F59E0B' }} />
            </div>
          </div>
        </div>

        {/* Stat card 6 — REJECTED */}
        <div className="card stat-rejected" style={{ padding: 16, gridColumn: '3/5' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(75,82,128,0.8)' }}>REJECTED</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#FCA5A5', letterSpacing: '-0.03em' }}>
              {loading ? '—' : stats?.rejected ?? 0}
            </p>
            <div style={{ width: 36, height: 36, background: 'rgba(239,68,68,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={18} style={{ color: '#EF4444' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Recent Claims + Total Claims breakdown ── */}
      <div className="dashboard-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12 }}>

        {/* Recent Claims table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,92,246,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', letterSpacing: '0.02em' }}>Recent Claims</p>
            <Link href="/claims" style={{ textDecoration: 'none', fontSize: 11, color: 'rgba(167,139,250,0.7)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              View All <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(4)].map((_, i) => <Shimmer key={i} h={36} r={6} />)}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(8,12,31,0.6)', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                  {['Employee', 'Category', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 20px', color: 'rgba(75,82,128,.7)', fontSize: 12 }}>
                    No claims yet. <Link href="/claims/new" style={{ color: '#A78BFA' }}>Submit one →</Link>
                  </td></tr>
                ) : recent.map(c => (
                  <tr key={c.id} className="table-tr" onClick={() => window.location.href = `/claims/${c.id}`} style={{ cursor: 'pointer' }}>
                    <td className="table-td" style={{ fontWeight: 600, color: '#F0F2FF' }}>{c.users?.full_name || 'Me'}</td>
                    <td className="table-td" style={{ textTransform: 'capitalize' }}>{c.category}</td>
                    <td className="table-td"><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#F0F2FF' }}>{formatCurrency(c.total_amount || 0)}</span></td>
                    <td className="table-td">
                      <span className={`badge badge-${c.status === 'approved' ? 'approved' : c.status === 'rejected' ? 'rejected' : c.fraud_score > 0.5 ? 'flagged' : c.status === 'validated' ? 'verified' : 'pending'}`}>
                        {c.status === 'rejected' ? 'Rejected' : c.fraud_score > 0.5 ? 'Flagged' : c.status === 'approved' ? 'Approved' : c.status === 'validated' ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="table-td" style={{ fontSize: 11 }}>{c.expense_date ? formatDate(c.expense_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Total Claims breakdown */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F0F2FF' }}>Total Claims</p>
            <BarChart3 size={14} style={{ color: '#A78BFA' }} />
          </div>

          {[
            { icon: '⊙', label: 'VERIFIED',  color: '#10B981', count: stats?.approved ?? 0 },
            { icon: '⚠', label: 'PENDING',   color: '#F59E0B', count: stats?.pending ?? 0 },
            { icon: '✗', label: 'REJECTED',  color: '#FCA5A5', count: stats?.rejected ?? 0 },
            { icon: '∑', label: 'TOTAL',     color: '#14B8A6', count: stats?.total ?? 0 },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.1)',
              borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
              transition: 'background .12s',
            }}>
              <span style={{ fontSize: 14, color: item.color }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: item.color }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#F0F2FF' }}>{loading ? '—' : item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Activity row ── */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Recent Activity</p>
          <Link href="/claims" style={{ textDecoration: 'none', fontSize: 10, color: 'rgba(167,139,250,0.6)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
            View All <ArrowRight size={10} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <FileText size={28} style={{ color: 'rgba(75,82,128,.4)', margin: '0 auto 8px' }} />
            <p style={{ color: 'rgba(75,82,128,.7)', fontSize: 12 }}>No recent activity</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
            {recent.map(c => (
              <div key={c.id} style={{
                minWidth: 160, background: 'rgba(13,18,48,0.6)', border: '1px solid rgba(139,92,246,0.1)',
                borderRadius: 10, padding: '10px 12px', flexShrink: 0, cursor: 'pointer',
              }} onClick={() => window.location.href = `/claims/${c.id}`}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#F0F2FF', marginBottom: 4 }}>{c.merchant_name || '—'}</p>
                <p style={{ fontSize: 10, color: 'rgba(75,82,128,.7)', textTransform: 'capitalize' }}>{c.category}</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#A78BFA', marginTop: 6, fontFamily: 'monospace' }}>
                  {formatCurrency(c.total_amount || 0)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
