'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { copilotApi, setAuthToken } from '@/lib/api'
import { X, Send, Sparkles, Bot, Loader } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }

const HINTS = ['Why was my claim rejected?','Show pending approvals','Carbon footprint this month?','Any fraud alerts?']

export default function CopilotWidget() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'assistant',
    content: `Hi ${user?.firstName || 'there'}! I'm your FinSight AI Copilot. How can I assist you today?`,
  }])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])

  const send = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setMsgs(p => [...p, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('unauthenticated')
      setAuthToken(token)
      const history = msgs.slice(1).map(m => ({ role: m.role, content: m.content }))
      const res = await copilotApi.chat(msg, history)
      setMsgs(p => [...p, { role: 'assistant', content: res.data.response }])
    } catch {
      setMsgs(p => [...p, { role: 'assistant', content: 'AI service temporarily unavailable. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 22, right: 22, zIndex: 999,
          width: 50, height: 50,
          background: open ? 'rgba(13,18,48,0.9)' : 'linear-gradient(135deg,#7C3AED,#A78BFA)',
          border: '1px solid rgba(139,92,246,0.4)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff',
          boxShadow: open ? 'none' : '0 0 24px rgba(139,92,246,0.5)',
          transition: 'all 0.2s',
        }}
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      {open && (
        <div className="slide-up" style={{
          position: 'fixed', bottom: 82, right: 22, zIndex: 998,
          width: 340, height: 480,
          background: 'rgba(13,18,48,0.95)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: 18, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.1)',
        }}>
          {/* Header */}
          <div style={{ background: 'rgba(8,12,31,0.8)', borderBottom: '1px solid rgba(139,92,246,0.15)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(167,139,250,0.2))', border: '1px solid rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} style={{ color: '#A78BFA' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#F0F2FF', lineHeight: 1 }}>FinSight Copilot</p>
              <p style={{ fontSize: 9, color: 'rgba(167,139,250,0.6)', marginTop: 2 }}>Powered by Claude AI</p>
            </div>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'pulseDot 2s infinite' }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(139,92,246,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={11} style={{ color: '#A78BFA' }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '80%',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg,#7C3AED,#8B5CF6)'
                    : 'rgba(255,255,255,0.04)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(139,92,246,0.15)',
                  borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  padding: '8px 12px', fontSize: 12, lineHeight: 1.55,
                  color: m.role === 'user' ? '#fff' : 'rgba(200,210,255,0.85)',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={11} style={{ color: '#A78BFA' }} />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '14px 14px 14px 3px', padding: '10px 14px', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', animation: 'pulseDot 1.2s infinite', animationDelay: `${i*0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Hints */}
          {msgs.length <= 1 && (
            <div style={{ padding: '0 10px 8px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {HINTS.map(h => (
                <button key={h} onClick={() => send(h)} style={{
                  background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 999, padding: '3px 10px', fontSize: 10,
                  color: '#A78BFA', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                }}>{h}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(139,92,246,0.1)', display: 'flex', gap: 7, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask anything…"
              disabled={loading}
              style={{
                flex: 1, background: 'rgba(5,7,20,0.8)',
                border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20,
                padding: '7px 13px', fontSize: 11, color: '#F0F2FF',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} style={{
              width: 32, height: 32,
              background: input.trim() ? 'linear-gradient(135deg,#7C3AED,#8B5CF6)' : 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'not-allowed', color: input.trim() ? '#fff' : '#4B5280',
              transition: 'all .15s',
            }}>
              {loading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
