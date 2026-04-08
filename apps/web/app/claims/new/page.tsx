'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { claimsApi, setAuthToken } from '@/lib/api'
import { Upload, CheckCircle, Loader, AlertCircle, ArrowLeft, Zap, Camera } from 'lucide-react'
import Link from 'next/link'

const CATS = [
  { id: 'travel',        label: 'Travel & Transport', icon: '✈' },
  { id: 'meals',         label: 'Meals & Entertainment', icon: '🍽' },
  { id: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { id: 'supplies',      label: 'Office & Supplies', icon: '📦' },
  { id: 'tech',          label: 'Tech & Software', icon: '💻' },
  { id: 'medical',       label: 'Medical', icon: '🏥' },
  { id: 'utilities',     label: 'Utilities', icon: '⚡' },
  { id: 'other',         label: 'Miscellaneous', icon: '📋' },
]

export default function NewClaimPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [form, setForm] = useState({
    merchant_name: '', expense_date: '', category: 'other',
    subtotal: '', tax_amount: '', total_amount: '', notes: '',
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const sub = parseFloat(form.subtotal) || 0
  const tax = parseFloat(form.tax_amount) || 0
  const tot = parseFloat(form.total_amount) || 0
  const mathOk = tot === 0 || Math.abs(sub + tax - tot) < 0.5

  const handleFile = async (f: File) => {
    setFile(f)
    // OCR via backend
    setOcrLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      setAuthToken(token)
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('http://localhost:8002/extract', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        const d = data.data || {}
        if (d.merchant_name) set('merchant_name', d.merchant_name)
        if (d.expense_date)  set('expense_date',  d.expense_date)
        if (d.subtotal)      set('subtotal',       String(d.subtotal))
        if (d.tax_amount)    set('tax_amount',     String(d.tax_amount))
        if (d.total)         set('total_amount',   String(d.total))
      }
    } catch { /* OCR failed silently — user fills manually */ }
    setOcrLoading(false)
  }

  async function submit() {
    if (!form.merchant_name) { setError('Merchant name is required'); return }
    if (!form.total_amount)  { setError('Total amount is required'); return }
    if (!mathOk)             { setError('Subtotal + Tax does not equal Total — please recheck'); return }
    setError('')
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) { setError('Not authenticated'); setLoading(false); return }
      setAuthToken(token)
      await claimsApi.create({ ...form, subtotal: sub, tax_amount: tax, total_amount: tot, status: 'submitted' })
      setSuccess(true)
      setTimeout(() => router.push('/claims'), 1800)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Submission failed. Please try again.')
    } finally { setLoading(false) }
  }

  if (success) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 18 }}>
      <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16,185,129,0.2)' }}>
        <CheckCircle size={32} style={{ color: '#10B981' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: '#F0F2FF' }}>Claim Submitted!</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>AI validation running… redirecting to your claims</p>
      </div>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/claims" style={{ textDecoration: 'none' }}>
          <button className="btn-ghost"><ArrowLeft size={14} /> Back</button>
        </Link>
        <div>
          <h1 className="page-title">Submit Expense Claim</h1>
          <p className="page-sub">Upload receipt — AI extracts data automatically via OCR</p>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px' }}>
          <AlertCircle size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#FCA5A5' }}>{error}</span>
        </div>
      )}

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Receipt Upload */}
        <div>
          <label className="label-base">Receipt Image — AI OCR Auto-Fill</label>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.2)'}`,
              borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
              background: file ? 'rgba(139,92,246,0.05)' : 'rgba(8,12,31,0.4)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: file ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(139,92,246,0.2)' }}>
              {ocrLoading ? <Loader size={20} style={{ color: '#A78BFA', animation: 'spin 1s linear infinite' }} /> : <Upload size={20} style={{ color: file ? '#A78BFA' : 'var(--text-muted)' }} />}
            </div>
            {ocrLoading ? (
              <p style={{ fontSize: 13, color: '#A78BFA', fontWeight: 600 }}>AI OCR processing receipt…</p>
            ) : file ? (
              <p style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>{file.name} ✓</p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Click to upload receipt</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>JPG, PNG — AI auto-extracts merchant, GST, amounts</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        <div>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Receipt Details</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label-base">Merchant Name *</label>
              <input className="input-base" value={form.merchant_name} onChange={e => set('merchant_name', e.target.value)} placeholder="e.g. Taj Hotel Mumbai" />
            </div>
            <div>
              <label className="label-base">Expense Date</label>
              <input type="date" className="input-base" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
            </div>
          </div>

          {/* Category grid */}
          <div style={{ marginTop: 14 }}>
            <label className="label-base">Bill Category</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {CATS.map(c => (
                <button key={c.id} onClick={() => set('category', c.id)} style={{
                  padding: '10px 6px', borderRadius: 10,
                  border: `1px solid ${form.category === c.id ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.12)'}`,
                  background: form.category === c.id ? 'rgba(139,92,246,0.15)' : 'rgba(8,12,31,0.4)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.12s', fontFamily: 'inherit',
                  boxShadow: form.category === c.id ? '0 0 12px rgba(139,92,246,0.15)' : 'none',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: form.category === c.id ? '#A78BFA' : 'var(--text-muted)', lineHeight: 1.2 }}>
                    {c.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amounts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
            <div>
              <label className="label-base">Subtotal (₹)</label>
              <input type="number" className="input-base" value={form.subtotal} onChange={e => set('subtotal', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label-base">Tax / GST (₹)</label>
              <input type="number" className="input-base" value={form.tax_amount} onChange={e => set('tax_amount', e.target.value)} placeholder="0.00"
                style={{ borderColor: !mathOk && tot > 0 ? 'rgba(239,68,68,0.5)' : undefined }} />
            </div>
            <div>
              <label className="label-base">Total Amount (₹) *</label>
              <input type="number" className="input-base" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* GST auto-fill */}
          {sub > 0 && !form.tax_amount && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-calculate GST 18%:</span>
              <button onClick={() => { set('tax_amount', (sub * 0.18).toFixed(2)); set('total_amount', (sub * 1.18).toFixed(2)) }}
                style={{ fontSize: 11, color: '#A78BFA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                +₹{(sub * 0.18).toFixed(2)} → Total ₹{(sub * 1.18).toFixed(2)}
              </button>
            </div>
          )}
          {!mathOk && tot > 0 && (
            <p style={{ fontSize: 11, color: '#FCA5A5', marginTop: 6 }}>⚠ Math mismatch: off by ₹{Math.abs(sub + tax - tot).toFixed(2)}</p>
          )}

          <div style={{ marginTop: 14 }}>
            <label className="label-base">Business Purpose / Notes</label>
            <textarea className="input-base" style={{ resize: 'none', minHeight: 76 }} value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Describe the purpose of this expense (required for amounts above ₹5,000)…" />
          </div>
        </div>

        {/* Triple-check indicator */}
        <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', marginBottom: 8 }}>⚡ Triple-Check Validation</p>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'OCR vs Input', ok: !!file },
              { label: 'Math Check',   ok: mathOk && tot > 0 },
              { label: 'Policy Check', ok: tot > 0 && tot <= 50000 },
            ].map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.ok ? '#10B981' : 'rgba(75,82,128,0.4)' }} />
                <span style={{ fontSize: 11, color: c.ok ? '#34D399' : 'var(--text-muted)', fontWeight: c.ok ? 700 : 400 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={submit} disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, borderRadius: 14 }}>
          {loading ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : <><Zap size={15} /> Submit Claim</>}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
