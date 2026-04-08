'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { claimsApi, adminApi, setAuthToken } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Shield, CheckCircle, FileCheck, Download } from 'lucide-react'

export default function CompliancePage() {
  const { getToken } = useAuth()
  const [claims, setClaims] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      setAuthToken(token)
      try {
        const [c, p] = await Promise.all([claimsApi.list(), adminApi.policies()])
        setClaims(c.data.claims || [])
        setPolicies(p.data.policies || [])
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [getToken])

  const approved  = claims.filter(c => c.status === 'approved').length
  const rejected  = claims.filter(c => c.status === 'rejected').length
  const flagged   = claims.filter(c => (c.fraud_score || 0) > 0.5).length
  const totalAmt  = claims.filter(c => c.status === 'approved').reduce((a, c) => a + (c.total_amount || 0), 0)
  const compliance = claims.length > 0 ? Math.round((approved / claims.length) * 100) : 100

  const BADGES = [
    { label: 'ISO 27001',        status: 'Active', clr: '#34D399', desc: 'Information security management' },
    { label: 'SOC 2 Type II',    status: 'Active', clr: '#34D399', desc: 'Security & availability controls' },
    { label: 'GDPR',             status: 'Active', clr: '#34D399', desc: 'Data protection regulation' },
    { label: 'PCI DSS',          status: 'Active', clr: '#34D399', desc: 'Payment card data security' },
    { label: 'RBI Guidelines',   status: 'Active', clr: '#34D399', desc: 'Reserve Bank of India compliance' },
    { label: 'IT Act 2000',      status: 'Active', clr: '#FCD34D', desc: 'Information Technology Act India' },
  ]

  if (loading) return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[...Array(4)].map((_, i) => <div key={i} className="shimmer" style={{ height: 100, borderRadius: 14 }} />)}
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Compliance Reports</h1>
          <p className="page-sub">Audit-ready financial compliance dashboard</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>
          <Download size={14} /> Export Report
        </button>
      </div>

      {/* Compliance score */}
      <div className="card" style={{ padding: 24, borderLeft: '3px solid #10B981' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 70, height: 70, borderRadius: '50%', border: '3px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#34D399' }}>{compliance}%</span>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#F0F2FF' }}>Overall Compliance Score</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Based on {claims.length} total claims — {approved} approved, {rejected} rejected, {flagged} flagged</p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Reimbursed</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(totalAmt)}</p>
          </div>
        </div>
        <div style={{ marginTop: 16, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${compliance}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 3, transition: 'width 1s ease' }} />
        </div>
      </div>

      {/* Compliance badges */}
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Active Compliance Certifications</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {BADGES.map(b => (
            <div key={b.label} style={{ background: 'rgba(8,12,31,0.5)', border: `1px solid ${b.clr}30`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <CheckCircle size={14} style={{ color: b.clr, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#F0F2FF' }}>{b.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: b.clr, background: `${b.clr}15`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.status}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active policies */}
      {policies.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(139,92,246,0.1)', background: 'rgba(8,12,31,0.6)' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Active Expense Policies</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr className="table-head">
              {['Policy Name','Category','Max Amount','Approval Above','Weekend Claims'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {policies.map((p: any) => (
                <tr key={p.id} className="table-tr">
                  <td className="table-td" style={{ fontWeight: 700, color: '#F0F2FF' }}>{p.name}</td>
                  <td className="table-td" style={{ textTransform: 'capitalize' }}>{p.category}</td>
                  <td className="table-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{formatCurrency(p.max_amount || 0)}</td>
                  <td className="table-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{formatCurrency(p.requires_approval_above || 0)}</td>
                  <td className="table-td">
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: p.weekend_claims_allowed ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: p.weekend_claims_allowed ? '#34D399' : '#FCA5A5' }}>
                      {p.weekend_claims_allowed ? 'Allowed' : 'Not Allowed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
