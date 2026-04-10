"use client"

import { useSignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function SignUpPage() {
  const router = useRouter()
  const { isLoaded, signUp, setActive } = useSignUp()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const getErrorMessage = (error: unknown) => {
    const clerkError = error as { errors?: Array<{ message?: string; longMessage?: string }> }
    if (clerkError?.errors?.length) {
      return clerkError.errors[0].longMessage || clerkError.errors[0].message || 'Authentication failed.'
    }
    return 'Something went wrong. Please try again.'
  }

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLoaded) return

    setErrorMessage('')
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)
      await signUp.create({
        firstName,
        lastName,
        emailAddress,
        password,
      })

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLoaded) return

    try {
      setIsSubmitting(true)
      setErrorMessage('')

      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.push('/dashboard')
        return
      }

      setErrorMessage('Verification is not complete yet. Please try again.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

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
        <div style={{
          width: '100%',
          background: 'rgba(13,18,48,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: 20,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          padding: 28,
          color: '#F0F2FF',
        }}>
          <h2 style={{ margin: 0, fontSize: 34, fontWeight: 800, textAlign: 'center', color: '#F0F2FF' }}>Create your account</h2>
          <p style={{ margin: '8px 0 22px', textAlign: 'center', color: '#A9B1D6', fontSize: 14 }}>
            Fill in your details and confirm your password to continue.
          </p>

          {!pendingVerification ? (
            <form onSubmit={handleCreateAccount} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  style={{ background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, color: '#F0F2FF', padding: '12px 14px', outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  style={{ background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, color: '#F0F2FF', padding: '12px 14px', outline: 'none' }}
                />
              </div>
              <input
                required
                type="email"
                placeholder="Email address"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                style={{ background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, color: '#F0F2FF', padding: '12px 14px', outline: 'none' }}
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, color: '#F0F2FF', padding: '12px 14px', outline: 'none' }}
              />
              <input
                required
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, color: '#F0F2FF', padding: '12px 14px', outline: 'none' }}
              />

              {errorMessage ? (
                <p style={{ margin: 0, color: '#FCA5A5', fontSize: 13 }}>{errorMessage}</p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !isLoaded}
                style={{
                  border: 0,
                  borderRadius: 999,
                  padding: '12px 16px',
                  color: '#fff',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #A78BFA 100%)',
                  boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Creating account...' : 'Continue'}
              </button>

              <p style={{ margin: '4px 0 0', textAlign: 'center', color: '#9CA3C8', fontSize: 14 }}>
                Already have an account?{' '}
                <Link href="/sign-in" style={{ color: '#C4B5FD', fontWeight: 600 }}>
                  Sign in
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyEmail} style={{ display: 'grid', gap: 12 }}>
              <p style={{ margin: '0 0 2px', color: '#A9B1D6', fontSize: 14 }}>
                We sent a verification code to your email. Enter it below to finish sign-up.
              </p>
              <input
                required
                type="text"
                placeholder="Verification code"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                style={{ background: 'rgba(5,7,20,0.8)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, color: '#F0F2FF', padding: '12px 14px', outline: 'none' }}
              />

              {errorMessage ? (
                <p style={{ margin: 0, color: '#FCA5A5', fontSize: 13 }}>{errorMessage}</p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !isLoaded}
                style={{
                  border: 0,
                  borderRadius: 999,
                  padding: '12px 16px',
                  color: '#fff',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #A78BFA 100%)',
                  boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Verifying...' : 'Verify and continue'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
