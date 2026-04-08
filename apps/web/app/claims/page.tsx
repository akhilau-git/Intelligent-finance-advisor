'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { claimsApi, setAuthToken } from '@/lib/api'
import { formatCurrency, formatDate, fraudColor } from '@/lib/utils'
import { Plus, Eye, FileText, Search } from 'lucide-react'

const STATUSES = ['all','draft','submitted','validated','review','approved','rejected','paid']

export default function ClaimsPage() {
  const { getToken } = useAuth()
  const [claims, setClaims] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    if (!token) return
    setAuthToken(token)
    try { const res = await claimsApi.list(filter === 'all' ? undefined : filter); setClaims(res.data.claims || []) }
    catch (e) { console.error(e) }
    setLoading(false)
  }, [getToken, filter])

  useEffect(() => { load() }, [load])

  const filtered = claims.filter(c => !search || (c.merchant_name||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><h1 className="page-title">My Claims</h1><p className="page-sub">{filtered.length} claims</p></div>
        <Link href="/claims/new" style={{ textDecoration: 'none' }}>
          <button className="btn-primary"><Plus size={14} /> Submit Claim</button>
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by merchant..." className="input-base" style={{ paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(8,12,31,0.8)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: 700, textTransform: 'capitalize', transition: 'all .12s', fontFamily: 'inherit',
              background: filter === s ? 'rgba(139,92,246,0.3)' : 'transparent',
              color: filter === s ? '#A78BFA' : 'var(--text-muted)',
            }}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="shimmer" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center' }}>
            <FileText size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No claims found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr className="table-head">
              {['Merchant','Category','Amount','Date','Status','Fraud','Auth',''].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(c => {
                const fraud = parseFloat(c.fraud_score || 0)
                return (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.merchant_name||'—'}</td>
                    <td className="table-td" style={{ textTransform: 'capitalize' }}>{c.category}</td>
                    <td className="table-td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>{formatCurrency(c.total_amount||0)}</span></td>
                    <td className="table-td">{c.expense_date ? formatDate(c.expense_date) : '—'}</td>
                    <td className="table-td"><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                    <td className="table-td">
                      <span style={{ fontSize:11, fontWeight:700, color: fraudColor(fraud) }}>{(fraud*100).toFixed(0)}%</span>
                    </td>
                    <td className="table-td">
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, textTransform:'uppercase',
                        background: c.authenticity_score==='green' ? 'rgba(16,185,129,.12)' : c.authenticity_score==='yellow' ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)',
                        color: c.authenticity_score==='green' ? '#34D399' : c.authenticity_score==='yellow' ? '#FCD34D' : '#FCA5A5',
                      }}>{c.authenticity_score||'—'}</span>
                    </td>
                    <td className="table-td">
                      <Link href={`/claims/${c.id}`} style={{ textDecoration:'none' }}>
                        <button className="btn-ghost" style={{ fontSize:11, padding:'4px 8px' }}><Eye size={12} /> View</button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
