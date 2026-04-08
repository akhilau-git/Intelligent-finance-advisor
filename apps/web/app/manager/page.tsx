'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { claimsApi, setAuthToken } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckCircle, XCircle, AlertTriangle, Eye, X, Loader, Shield } from 'lucide-react'

export default function ManagerPage() {
  const { getToken } = useAuth()
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    setAuthToken(token)
    try {
      const [v, r] = await Promise.all([claimsApi.list('validated'), claimsApi.list('review')])
      setClaims([...(v.data.claims || []), ...(r.data.claims || [])])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [getToken])

  useEffect(() => { load() }, [load])

  const act = async (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !reason.trim()) { alert('Please enter a rejection reason'); return }
    setActing(true)
    const token = await getToken()
    if (token) { setAuthToken(token); try { await claimsApi.updateStatus(selected.id, status, reason || undefined) } catch (e) { console.error(e) } }
    setSelected(null); setReason('')
    await load(); setActing(false)
  }

  const fraudHigh = claims.filter(c => (c.fraud_score || 0) > 0.5)

  if (loading) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[...Array(5)].map((_, i) => <div key={i} className="shimmer" style={{ height: 50, borderRadius: 10 }} />)}
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 className="page-title">Pending Approvals</h1>
        <p className="page-sub">{claims.length} claims require your review</p>
      </div>

      {fraudHigh.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px' }}>
          <AlertTriangle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#FCA5A5', fontWeight: 700 }}>
            {fraudHigh.length} claim{fraudHigh.length > 1 ? 's' : ''} with HIGH fraud score — review carefully before approving
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Awaiting Approval', val: claims.filter(c => c.status === 'validated').length, clr: '#FCD34D', bg: 'rgba(245,158,11,0.1)' },
          { label: 'In Review',          val: claims.filter(c => c.status === 'review').length,    clr: '#A78BFA', bg: 'rgba(139,92,246,0.1)' },
          { label: 'High Risk',          val: fraudHigh.length,                                      clr: '#FCA5A5', bg: 'rgba(239,68,68,0.1)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</p>
            <p style={{ fontSize: 32, fontWeight: 900, color: s.clr, letterSpacing: '-0.03em', marginTop: 8 }}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {claims.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <CheckCircle size={36} style={{ color: '#10B981', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>All caught up — no pending approvals!</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr className="table-head">
              {['Employee','Merchant','Amount','Category','Auth','Fraud Risk','Status','Actions'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {claims.map(c => {
                const fraud = parseFloat(c.fraud_score || 0)
                const isHigh = fraud > 0.5
                return (
                  <tr key={c.id} className="table-tr" style={{ background: isHigh ? 'rgba(239,68,68,0.03)' : undefined }}>
                    <td className="table-td" style={{ fontWeight: 700, color: '#F0F2FF' }}>{c.users?.full_name || '—'}</td>
                    <td className="table-td">{c.merchant_name || '—'}</td>
                    <td className="table-td"><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: '#F0F2FF' }}>{formatCurrency(c.total_amount || 0)}</span></td>
                    <td className="table-td" style={{ textTransform: 'capitalize' }}>{c.category}</td>
                    <td className="table-td">
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
                        background: c.authenticity_score === 'green' ? 'rgba(16,185,129,0.12)' : c.authenticity_score === 'yellow' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                        color: c.authenticity_score === 'green' ? '#34D399' : c.authenticity_score === 'yellow' ? '#FCD34D' : '#FCA5A5',
                      }}>{c.authenticity_score || '—'}</span>
                    </td>
                    <td className="table-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 48, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${fraud * 100}%`, height: '100%', borderRadius: 2, background: isHigh ? '#EF4444' : fraud > 0.2 ? '#F59E0B' : '#10B981' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: isHigh ? '#FCA5A5' : fraud > 0.2 ? '#FCD34D' : '#34D399' }}>{(fraud * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="table-td">
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
                        background: c.status === 'review' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.12)',
                        color: c.status === 'review' ? '#A78BFA' : '#FCD34D',
                      }}>{c.status}</span>
                    </td>
                    <td className="table-td">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setSelected(c); setReason('') }} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}><Eye size={12} /> Review</button>
                        <button onClick={async () => { setSelected(c); await act('approved') }} className="btn-success" style={{ padding: '4px 10px', fontSize: 11 }}>✓</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="slide-up" style={{ background: 'var(--bg-card)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.7), 0 0 40px rgba(139,92,246,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.15)', background: 'rgba(8,12,31,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} style={{ color: '#A78BFA' }} />
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#F0F2FF' }}>Review Claim</h3>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Merchant',    selected.merchant_name || '—'],
                  ['Amount',      formatCurrency(selected.total_amount || 0)],
                  ['Employee',    selected.users?.full_name || '—'],
                  ['Date',        selected.expense_date ? formatDate(selected.expense_date) : '—'],
                  ['Category',    selected.category],
                  ['Fraud Score', `${((selected.fraud_score || 0) * 100).toFixed(0)}%`],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(8,12,31,0.5)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#F0F2FF', marginTop: 3, textTransform: 'capitalize' }}>{v}</p>
                  </div>
                ))}
              </div>
              {selected.fraud_flags?.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#FCA5A5', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fraud Signals</p>
                  {selected.fraud_flags.map((f: any, i: number) => (
                    <p key={i} style={{ fontSize: 11, color: 'rgba(252,165,165,0.8)', padding: '2px 0' }}>• {f.signal?.replace(/_/g, ' ')}: +{(f.score * 100).toFixed(0)}%</p>
                  ))}
                </div>
              )}
              <div>
                <label className="label-base">Rejection Reason <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(required to reject)</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} className="input-base" style={{ resize: 'none', minHeight: 80 }} placeholder="Explain why this claim is being rejected…" />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => act('approved')} disabled={acting} className="btn-success" style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>
                  {acting ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />} Approve
                </button>
                <button onClick={() => act('rejected')} disabled={acting} className="btn-danger" style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>
                  {acting ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={14} />} Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
