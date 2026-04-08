'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import { claimsApi, setAuthToken } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, Hash, Leaf } from 'lucide-react'

export default function ClaimDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      setAuthToken(token)
      try { const res = await claimsApi.get(id as string); setData(res.data) }
      catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [id, getToken])

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[...Array(3)].map((_, i) => <div key={i} className="shimmer" style={{ height: 160, borderRadius: 14 }} />)}
    </div>
  )
  if (!data) return <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>Claim not found</div>

  const { claim, audit_log } = data
  const fraud = parseFloat(claim.fraud_score || 0)
  const fraudClr = fraud > 0.5 ? '#FCA5A5' : fraud > 0.2 ? '#FCD34D' : '#34D399'
  const authClr  = claim.authenticity_score === 'green' ? '#34D399' : claim.authenticity_score === 'yellow' ? '#FCD34D' : '#FCA5A5'

  const STATUS_CLR: Record<string, string> = {
    approved: '#34D399', rejected: '#FCA5A5', review: '#FCD34D',
    validated: '#A78BFA', submitted: '#60A5FA', paid: '#2DD4BF',
  }

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => router.back()} className="btn-ghost"><ArrowLeft size={14} /> Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">{claim.merchant_name || 'Unnamed Claim'}</h1>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              background: `${STATUS_CLR[claim.status] || '#9CA3C8'}18`,
              color: STATUS_CLR[claim.status] || '#9CA3C8',
              border: `1px solid ${STATUS_CLR[claim.status] || '#9CA3C8'}40`,
            }}>{claim.status}</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>ID: {String(claim.id).slice(0, 16)}…</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Receipt info */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Receipt Information</p>
          {[
            ['Merchant',    claim.merchant_name || '—'],
            ['GST / ID',    claim.merchant_id   || 'Not detected'],
            ['Date',        claim.expense_date ? formatDate(claim.expense_date) : '—'],
            ['Category',    claim.category],
            ['Currency',    claim.currency || 'INR'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{v}</span>
            </div>
          ))}
          <div style={{ background: 'rgba(8,12,31,0.5)', borderRadius: 10, padding: 14, marginTop: 14, border: '1px solid rgba(139,92,246,0.1)' }}>
            {[['Subtotal', formatCurrency(claim.subtotal || 0)], ['Tax (GST)', formatCurrency(claim.tax_amount || 0)]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid rgba(139,92,246,0.15)', marginTop: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#F0F2FF' }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#F0F2FF', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(claim.total_amount || 0)}</span>
            </div>
          </div>
          {claim.notes && (
            <div style={{ marginTop: 14, background: 'rgba(139,92,246,0.05)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(139,92,246,0.1)' }}>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{claim.notes}"</p>
            </div>
          )}
        </div>

        {/* Validation */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>AI Validation Results</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,12,31,0.5)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={15} style={{ color: authClr }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Authenticity Score</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: authClr }}>{claim.authenticity_score || 'Pending'}</span>
          </div>

          <div style={{ background: 'rgba(8,12,31,0.5)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} style={{ color: fraudClr }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fraud Score</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: fraudClr, fontFamily: 'JetBrains Mono, monospace' }}>{(fraud * 100).toFixed(1)}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${fraud * 100}%`, height: '100%', background: fraudClr, borderRadius: 2, transition: 'width 0.8s ease' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,12,31,0.5)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} style={{ color: '#60A5FA' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>OCR Confidence</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F2FF', fontFamily: 'JetBrains Mono, monospace' }}>
              {claim.ocr_confidence ? `${(claim.ocr_confidence * 100).toFixed(1)}%` : 'Not scanned'}
            </span>
          </div>

          {claim.fraud_flags?.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#FCA5A5', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fraud Signals</p>
              {claim.fraud_flags.map((f: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(239,68,68,0.08)' }}>
                  <span style={{ fontSize: 11, color: '#FCA5A5' }}>• {f.signal?.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#FCA5A5', fontFamily: 'JetBrains Mono, monospace' }}>+{(f.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}

          {claim.rejection_reason && (
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#FCA5A5', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Rejection Reason</p>
              <p style={{ fontSize: 12, color: 'rgba(252,165,165,0.8)' }}>{claim.rejection_reason}</p>
            </div>
          )}

          {(claim.carbon_kg || 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Leaf size={14} style={{ color: '#10B981' }} />
                <span style={{ fontSize: 12, color: '#34D399' }}>Carbon Footprint</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#34D399', fontFamily: 'JetBrains Mono, monospace' }}>{parseFloat(claim.carbon_kg).toFixed(3)} kg CO₂</span>
            </div>
          )}
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hash size={15} style={{ color: '#A78BFA' }} />
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Immutable Blockchain Audit Trail</p>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{audit_log.length} entries · SHA-256 chained</span>
        </div>

        {audit_log.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No audit entries yet</p>
        ) : (
          <div>
            {audit_log.map((entry: any, i: number) => (
              <div key={entry.id} style={{ display: 'flex', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: i === 0 ? '#A78BFA' : 'rgba(139,92,246,0.3)', border: `2px solid ${i === 0 ? '#A78BFA' : 'rgba(139,92,246,0.2)'}`, boxShadow: i === 0 ? '0 0 8px rgba(167,139,250,0.5)' : 'none' }} />
                  {i < audit_log.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(139,92,246,0.15)', margin: '3px 0' }} />}
                </div>
                <div style={{ paddingBottom: 16, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F2FF' }}>{entry.action}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(entry.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>
                    {entry.hash?.slice(0, 40)}…
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
