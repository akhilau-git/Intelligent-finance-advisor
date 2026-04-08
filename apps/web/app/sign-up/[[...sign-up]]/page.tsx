import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#050714',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(76,29,149,0.5) 0%, transparent 70%)' }} />
      <div className="star-field" />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 440, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 900,
            background: 'linear-gradient(135deg, #F5D67A 0%, #F5A623 50%, #D4891A 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>FinSight</h1>
          <p style={{ fontSize: 10, color: 'rgba(245,198,66,.6)', letterSpacing: '.35em', textTransform: 'uppercase', marginTop: 4 }}>IFOS</p>
        </div>
        <SignUp
          appearance={{
            variables: {
              colorBackground: 'rgba(13,18,48,0.85)', colorText: '#F0F2FF',
              colorInputBackground: 'rgba(8,12,31,0.9)', colorInputText: '#F0F2FF',
              colorPrimary: '#8B5CF6', colorDanger: '#EF4444',
              borderRadius: '16px', fontFamily: 'Inter, system-ui, sans-serif',
            },
            elements: {
              rootBox: 'w-full',
              card: { background: 'rgba(13,18,48,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' },
              headerTitle: { color: '#F0F2FF', fontWeight: '800' },
              formFieldInput: { background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.2)', color: '#F0F2FF' },
              formButtonPrimary: { background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #A78BFA 100%)', fontWeight: '800' },
              footerActionLink: { color: '#A78BFA' },
            },
          }}
          afterSignUpUrl="/dashboard"
        />
      </div>
    </div>
  )
}
