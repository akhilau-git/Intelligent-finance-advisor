'use client'
import { useEffect } from 'react'
import { useUser, useAuth } from '@clerk/nextjs'
import { usersApi, setAuthToken } from '@/lib/api'

export default function UserSync() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  useEffect(() => {
    if (!isLoaded || !user) return
    async function sync() {
      const token = await getToken()
      if (!token) return
      setAuthToken(token)
      try {
        await usersApi.syncUser({
          clerk_id: user!.id,
          email: user!.emailAddresses[0]?.emailAddress || '',
          full_name: user!.fullName || user!.firstName || 'User',
          role: (user!.publicMetadata?.role as string) || 'employee',
        })
      } catch (e) { console.warn('User sync:', e) }
    }
    sync()
  }, [isLoaded, user])
  return null
}
