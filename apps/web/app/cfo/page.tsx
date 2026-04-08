'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { analyticsApi, claimsApi, setAuthToken } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { TrendingUp, Leaf, AlertTriangle, IndianRupee, BarChart3, TrendingDown } from 'lucide-react'

const COLORS = ['#8B5CF6','#10B981','#F59E0B','#EF4444','#3B82F6','#14B8A6']

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(13,18,48,0.95)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, color: 'rgba(167,139,250,0.7)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function CfoPage() {
  const { getToken } = useAuth()
  const [overview, setOverview] = useState<any>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      setAuthToken(token)
      try {
        const [o, c] = await Promise.all([analyticsApi.overview(), claimsApi.list()])
        setOverview(o.data); setClaims(c.data.claims || [])
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [getToken])

  const catBreakdown = (() => {
    const m: Record<string, number> = {}
    claims.forEach(c => { if (c.status !== 'rejected') m[c.category] = (m[c.category] || 0) + (c.total_amount || 0) })
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) }))
  })()

  const monthlyTrend = (() => {
    const m: Record<string, number> = {}
    claims.forEach(c => {
      const month = new Date(c.created_at).toLocaleString('default', { month: 'short' })
      m[month] = (m[month] || 0) + (c.total_amount || 0)
    })
    return Object.entries(m).slice(-6).map(([month, amount]) => ({ month, amount: Math.round(amount) }))
  })()

  const totalCarbon = claims.reduce((a, c) => a + (parseFloat(c.carbon_kg) || 0), 0)
  const fraudSaved  = claims.filter(c => c.status === 'rejected' && (c.fraud_score || 0) > 0.5).reduce((a, c) => a + (c.total_amount || 0), 0)

  if (loading) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="shimmer" style={{ height: 36, width: 200, borderRadius: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[...Array(4)].map((_, i) => <div key={i} className="shimmer" style={{ height: 100, borderRadius: 14 }} />)}
      </div>
    </div>
  )

  const KPIS = [
    { label: 'Total Spend',      val: formatCurrency(overview?.total_spend || 0),  icon: IndianRupee,   clr: '#A78BFA', bg: 'rgba(139,92,246,0.12)' },
    { label: 'Total Claims',     val: String(overview?.claim_count || 0),            icon: BarChart3,     clr: '#60A5FA', bg: 'rgba(59,130,246,0.12)' },
    { label: 'Carbon Footprint', val: `${totalCarbon.toFixed(1)} kg CO₂`,            icon: Leaf,          clr: '#34D399', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Fraud Prevented',  val: formatCurrency(fraudSaved),                    icon: AlertTriangle, clr: '#FCD34D', bg: 'rgba(245,158,11,0.12)' },
  ]

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 className="page-title">CFO Analytics</h1>
        <p className="page-sub">Executive overview · Predictive forecasting · ESG intelligence</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {KPIS.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#F0F2FF', marginTop: 8, letterSpacing: '-0.02em', fontFamily: 'JetBrains Mono, monospace' }}>{k.val}</p>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color: k.clr }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 18 }}>Monthly Spend Trend</p>
          {monthlyTrend.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet — submit some claims</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyTrend} barSize={22}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(139,92,246,0.08)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(75,82,128,0.8)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(75,82,128,0.8)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                <Bar dataKey="amount" fill="#8B5CF6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 18 }}>Spend by Category</p>
          {catBreakdown.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={3}>
                  {catBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)}
                  contentStyle={{ background: 'rgba(13,18,48,0.95)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ESG */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Leaf size={15} style={{ color: '#10B981' }} />
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>ESG Carbon Footprint by Category</p>
        </div>
        {catBreakdown.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No ESG data yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {catBreakdown.map((cat, i) => {
              const co2 = claims.filter(c => c.category === cat.name).reduce((a, c) => a + (parseFloat(c.carbon_kg) || 0), 0)
              const pct = totalCarbon > 0 ? (co2 / totalCarbon) * 100 : 0
              return (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)', width: 110, flexShrink: 0 }}>{cat.name}</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 2, transition: 'width 0.8s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 70, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{co2.toFixed(2)} kg</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', width: 36, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{pct.toFixed(0)}%</span>
                </div>
              )
            })}
            {totalCarbon > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', borderTop: '1px solid rgba(139,92,246,0.12)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Total Carbon Footprint</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#34D399', fontFamily: 'JetBrains Mono, monospace' }}>{totalCarbon.toFixed(2)} kg CO₂</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
