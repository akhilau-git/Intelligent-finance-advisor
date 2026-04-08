import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#050714',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ── Deep space background ── */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(76,29,149,0.5) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 20% 80%, rgba(30,10,80,0.6) 0%, transparent 60%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 80% 80%, rgba(20,8,60,0.5) 0%, transparent 60%)' }} />

      {/* ── Cityscape silhouette at bottom ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '220px', overflow: 'hidden' }}>
        {/* City buildings using CSS shapes */}
        <svg viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', bottom: 0, width: '100%' }}>
          <defs>
            <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(60,20,140,0.6)" />
              <stop offset="100%" stopColor="rgba(10,5,30,0.9)" />
            </linearGradient>
            <linearGradient id="glowGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(120,60,255,0.6)" />
              <stop offset="100%" stopColor="rgba(120,60,255,0)" />
            </linearGradient>
          </defs>
          {/* Ground glow */}
          <rect x="0" y="180" width="1440" height="40" fill="url(#glowGrad)" opacity="0.4" />
          {/* Buildings left */}
          <rect x="0"   y="120" width="40"  height="100" fill="url(#cityGrad)" />
          <rect x="50"  y="80"  width="30"  height="140" fill="url(#cityGrad)" />
          <rect x="90"  y="100" width="50"  height="120" fill="url(#cityGrad)" />
          <rect x="150" y="60"  width="35"  height="160" fill="url(#cityGrad)" />
          <rect x="195" y="90"  width="45"  height="130" fill="url(#cityGrad)" />
          <rect x="250" y="110" width="30"  height="110" fill="url(#cityGrad)" />
          <rect x="290" y="70"  width="40"  height="150" fill="url(#cityGrad)" />
          <rect x="340" y="95"  width="55"  height="125" fill="url(#cityGrad)" />
          {/* Buildings right */}
          <rect x="1050" y="95"  width="55"  height="125" fill="url(#cityGrad)" />
          <rect x="1115" y="70"  width="40"  height="150" fill="url(#cityGrad)" />
          <rect x="1165" y="110" width="30"  height="110" fill="url(#cityGrad)" />
          <rect x="1205" y="90"  width="45"  height="130" fill="url(#cityGrad)" />
          <rect x="1260" y="60"  width="35"  height="160" fill="url(#cityGrad)" />
          <rect x="1305" y="100" width="50"  height="120" fill="url(#cityGrad)" />
          <rect x="1365" y="80"  width="30"  height="140" fill="url(#cityGrad)" />
          <rect x="1400" y="120" width="40"  height="100" fill="url(#cityGrad)" />
          {/* Window lights */}
          {[60,70,80,160,165,200,205,300,310,1120,1130,1220,1230,1270,1280].map((x, i) => (
            <rect key={i} x={x} y={90 + (i % 3) * 15} width="4" height="3"
              fill={i % 4 === 0 ? '#F5A623' : i % 4 === 1 ? '#A78BFA' : '#60A5FA'}
              opacity="0.7" />
          ))}
          {/* Ground reflection glow */}
          <ellipse cx="720" cy="220" rx="500" ry="30" fill="rgba(100,50,220,0.15)" />
        </svg>
      </div>

      {/* ── Globe left side ── */}
      <div style={{ position: 'absolute', left: '-80px', top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }}>
        <svg width="320" height="320" viewBox="0 0 320 320" style={{ animation: 'rotateSlow 20s linear infinite' }}>
          <defs>
            <radialGradient id="globeGrad" cx="40%" cy="35%">
              <stop offset="0%" stopColor="rgba(100,150,255,0.8)" />
              <stop offset="40%" stopColor="rgba(30,60,180,0.5)" />
              <stop offset="100%" stopColor="rgba(5,10,40,0.9)" />
            </radialGradient>
            <filter id="globeGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" />
            </filter>
          </defs>
          {/* Globe sphere */}
          <circle cx="160" cy="160" r="140" fill="url(#globeGrad)" stroke="rgba(100,150,255,0.3)" strokeWidth="1" />
          {/* Grid lines */}
          <ellipse cx="160" cy="160" rx="140" ry="55" fill="none" stroke="rgba(100,180,255,0.2)" strokeWidth="0.8" />
          <ellipse cx="160" cy="160" rx="140" ry="100" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.8" />
          <ellipse cx="160" cy="160" rx="100" ry="140" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.8" />
          <ellipse cx="160" cy="160" rx="50"  ry="140" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.8" />
          <line x1="20" y1="160" x2="300" y2="160" stroke="rgba(100,180,255,0.2)" strokeWidth="0.8" />
          <line x1="160" y1="20" x2="160" y2="300" stroke="rgba(100,180,255,0.2)" strokeWidth="0.8" />
          {/* Orbital ring */}
          <ellipse cx="160" cy="160" rx="160" ry="40" fill="none" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" transform="rotate(-20 160 160)" />
          <circle cx="290" cy="130" r="4" fill="#A78BFA" />
          {/* Glow dots */}
          <circle cx="110" cy="130" r="3" fill="rgba(100,200,255,0.8)" />
          <circle cx="200" cy="180" r="2" fill="rgba(245,166,35,0.9)" />
          <circle cx="150" cy="200" r="2" fill="rgba(167,139,250,0.8)" />
        </svg>
      </div>

      {/* ── Security shield right ── */}
      <div style={{ position: 'absolute', right: '80px', top: '35%', opacity: 0.5 }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          <path d="M45 5 L75 18 L75 45 Q75 68 45 82 Q15 68 15 45 L15 18 Z"
            fill="rgba(20,184,166,0.15)" stroke="rgba(20,184,166,0.5)" strokeWidth="1.5" />
          <path d="M30 45 L40 55 L60 35" fill="none" stroke="#14B8A6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── Document icons right ── */}
      <div style={{ position: 'absolute', right: '60px', top: '50%', opacity: 0.4 }}>
        <svg width="60" height="80" viewBox="0 0 60 80">
          <rect x="5" y="5" width="40" height="50" rx="4" fill="rgba(139,92,246,0.2)" stroke="rgba(139,92,246,0.5)" strokeWidth="1" />
          <line x1="12" y1="20" x2="38" y2="20" stroke="rgba(167,139,250,0.6)" strokeWidth="1.5" />
          <line x1="12" y1="28" x2="38" y2="28" stroke="rgba(167,139,250,0.6)" strokeWidth="1.5" />
          <line x1="12" y1="36" x2="28" y2="36" stroke="rgba(245,166,35,0.6)" strokeWidth="1.5" />
          <rect x="15" y="35" width="40" height="50" rx="4" fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.4)" strokeWidth="1" />
        </svg>
      </div>

      {/* ── Star field ── */}
      <div className="star-field" />

      {/* ── Main content ── */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 440, padding: '0 24px' }}>

        {/* Gold Logo */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          {/* Eye/chart SVG icon — matching the gold logo image */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="64" height="40" viewBox="0 0 64 40" fill="none">
              <defs>
                <linearGradient id="goldLg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F5D67A" />
                  <stop offset="50%" stopColor="#F5A623" />
                  <stop offset="100%" stopColor="#D4891A" />
                </linearGradient>
              </defs>
              {/* Eye shape */}
              <path d="M2 20 Q32 0 62 20 Q32 40 2 20Z" fill="none" stroke="url(#goldLg)" strokeWidth="2" />
              {/* Iris circle */}
              <circle cx="32" cy="20" r="12" fill="none" stroke="url(#goldLg)" strokeWidth="1.5" />
              {/* Chart bars inside */}
              <rect x="24" y="22" width="4" height="6" rx="1" fill="url(#goldLg)" opacity="0.9" />
              <rect x="30" y="17" width="4" height="11" rx="1" fill="url(#goldLg)" opacity="0.9" />
              <rect x="36" y="20" width="4" height="8" rx="1" fill="url(#goldLg)" opacity="0.9" />
              {/* Sweep lines left */}
              <path d="M2 20 Q10 12 18 14" stroke="url(#goldLg)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M2 20 Q10 28 18 26" stroke="url(#goldLg)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          {/* Brand text */}
          <h1 style={{
            fontSize: 42, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1,
            background: 'linear-gradient(135deg, #F5D67A 0%, #F5A623 40%, #D4891A 80%, #F5D67A 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 20px rgba(245,166,35,0.5))',
          }}>
            FinSight
          </h1>
          <p style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.35em',
            color: 'rgba(245,198,66,0.7)', textTransform: 'uppercase', marginTop: 4,
          }}>IFOS</p>
          <p style={{
            fontSize: 12, color: 'rgba(200,210,255,0.5)', letterSpacing: '0.08em',
            marginTop: 4, fontWeight: 400,
          }}>Intelligent Financial Oversight System</p>
        </div>

        {/* Clerk Sign In — glassmorphism card */}
        <div style={{ width: '100%' }}>
          <SignIn
            appearance={{
              variables: {
                colorBackground:      'rgba(13,18,48,0.85)',
                colorText:            '#F0F2FF',
                colorTextSecondary:   '#9CA3C8',
                colorInputBackground: 'rgba(8,12,31,0.9)',
                colorInputText:       '#F0F2FF',
                colorPrimary:         '#8B5CF6',
                colorDanger:          '#EF4444',
                borderRadius:         '16px',
                spacingUnit:          '18px',
                fontFamily:           'Inter, system-ui, sans-serif',
              },
              elements: {
                rootBox: 'w-full',
                card: {
                  background:   'rgba(13,18,48,0.85)',
                  backdropFilter: 'blur(20px)',
                  border:       '1px solid rgba(139,92,246,0.25)',
                  boxShadow:    '0 0 60px rgba(139,92,246,0.15), 0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                },
                headerTitle:      { color: '#F0F2FF', fontWeight: '800', fontSize: '20px' },
                headerSubtitle:   { color: '#9CA3C8' },
                socialButtonsBlockButton: {
                  background:   'rgba(139,92,246,0.08)',
                  border:       '1px solid rgba(139,92,246,0.2)',
                  color:        '#D0D4F0',
                },
                socialButtonsBlockButtonText: { color: '#D0D4F0', fontWeight: '600' },
                dividerLine:      { background: 'rgba(139,92,246,0.2)' },
                dividerText:      { color: '#4B5280' },
                formFieldLabel:   { color: '#9CA3C8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' },
                formFieldInput:   { background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.2)', color: '#F0F2FF' },
                formButtonPrimary: {
                  background:   'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #A78BFA 100%)',
                  color:        '#fff',
                  fontWeight:   '800',
                  letterSpacing: '0.02em',
                  boxShadow:    '0 4px 20px rgba(139,92,246,0.4)',
                },
                footerActionLink: { color: '#A78BFA' },
                footerActionText: { color: '#4B5280' },
              },
            }}
            afterSignInUrl="/dashboard"
            afterSignUpUrl="/dashboard"
          />
        </div>
      </div>

      {/* ── Compliance footer ── */}
      <div style={{
        position: 'absolute', bottom: 20, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 24, zIndex: 10,
      }}>
        {['ISO 27001', 'SOC 2 TYPE', 'PCI DSS', 'END-TO-END ENCRYPTED'].map(b => (
          <span key={b} style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            color: 'rgba(167,139,250,0.4)', textTransform: 'uppercase',
          }}>{b}</span>
        ))}
      </div>

      <style>{`
        @keyframes rotateSlow { to { transform: translateY(-50%) rotate(360deg); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  )
}
