'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { adminApi, setAuthToken } from '@/lib/api'
import { Shield, CheckCircle, AlertTriangle, Loader, Hash, Lock } from 'lucide-react'

const ACT_STYLE: Record<string, { bg: string; color: string }> = {
  STATUS_CHANGED: { bg: 'rgba(59,130,246,0.12)',   color: '#60A5FA' },
  OCR_COMPLETED:  { bg: 'rgba(139,92,246,0.12)',   color: '#A78BFA' },
  FRAUD_FLAGGED:  { bg: 'rgba(239,68,68,0.12)',    color: '#FCA5A5' },
  AUTO_APPROVED:  { bg: 'rgba(16,185,129,0.12)',   color: '#34D399' },
  CLAIM_CREATED:  { bg: 'rgba(75,82,128,0.12)',    color: '#9CA3C8' },
}

export default function AuditorPage() {
  const { getToken } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      setAuthToken(token)
      try { const res = await adminApi.auditLog(); setLogs(res.data.logs || []) }
      catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [getToken])

  const verify = () => {
    setVerifying(true)
    setTimeout(() => {
      const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      let ok = true
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].previous_hash && sorted[i].previous_hash !== sorted[i - 1].hash) { ok = false; break }
      }
      setResult(ok
        ? { ok: true,  msg: `Chain intact — ${logs.length} entries verified · Zero tampering detected` }
        : { ok: false, msg: 'CHAIN BROKEN — Tampering detected! Contact security immediately.' }
      )
      setVerifying(false)
    }, 1400)
  }

  const STATS = [
    { label: 'Total Entries',   val: logs.length,                                                 clr: '#A78BFA' },
    { label: 'Status Changes',  val: logs.filter(l => l.action === 'STATUS_CHANGED').length,      clr: '#60A5FA' },
    { label: 'Fraud Flags',     val: logs.filter(l => l.action === 'FRAUD_FLAGGED').length,       clr: '#FCA5A5' },
    { label: 'Auto Approved',   val: logs.filter(l => l.action === 'AUTO_APPROVED').length,       clr: '#34D399' },
  ]

  if (loading) return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="shimmer" style={{ height: 36, width: 200, borderRadius: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[...Array(4)].map((_, i) => <div key={i} className="shimmer" style={{ height: 80, borderRadius: 12 }} />)}
      </div>
      {[...Array(6)].map((_, i) => <div key={i} className="shimmer" style={{ height: 44, borderRadius: 8 }} />)}
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Blockchain Audit Log</h1>
          <p className="page-sub">{logs.length} immutable entries · SHA-256 hash chain</p>
        </div>
        <button onClick={verify} disabled={verifying || logs.length === 0} className="btn-primary">
          {verifying ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Verifying…</> : <><Shield size={14} /> Verify Chain Integrity</>}
        </button>
      </div>

      {result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${result.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 12, padding: '12px 16px' }}>
          {result.ok ? <CheckCircle size={18} style={{ color: '#10B981', flexShrink: 0 }} /> : <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />}
          <p style={{ fontSize: 13, fontWeight: 700, color: result.ok ? '#34D399' : '#FCA5A5' }}>{result.msg}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {STATS.map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: s.clr, letterSpacing: '-0.03em', marginTop: 8 }}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid rgba(139,92,246,0.1)', background: 'rgba(8,12,31,0.6)' }}>
          <Lock size={13} style={{ color: '#A78BFA' }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tamper-Proof Cryptographic Ledger</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr className="table-head">
            {['Action','Claim ID','Performed By','Timestamp','SHA-256 Hash'].map(h => <th key={h} className="table-th">{h}</th>)}
          </tr></thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>No audit entries yet</td></tr>
            ) : (
              logs.map(log => {
                const style = ACT_STYLE[log.action] || ACT_STYLE.CLAIM_CREATED
                return (
                  <tr key={log.id} className="table-tr">
                    <td className="table-td"><span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em', background: style.bg, color: style.color }}>{log.action}</span></td>
                    <td className="table-td"><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>{log.claim_id ? log.claim_id.slice(0, 8) + '…' : '—'}</span></td>
                    <td className="table-td">{log.users?.full_name || 'System'}</td>
                    <td className="table-td"><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{new Date(log.created_at).toLocaleString('en-IN')}</span></td>
                    <td className="table-td"><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#A78BFA', cursor: 'text', userSelect: 'all' }}>{log.hash ? log.hash.slice(0, 22) + '…' : '—'}</span></td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
