import axios from 'axios'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
export const api = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' } })

export function setAuthToken(token: string) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export const claimsApi = {
  list:         (status?: string) => api.get('/claims/', { params: status ? { status } : {} }),
  get:          (id: string)      => api.get(`/claims/${id}`),
  create:       (data: any)       => api.post('/claims/', data),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/claims/${id}/status`, { status, rejection_reason: reason }),
  getStats:     ()                => api.get('/claims/stats'),
}

export const usersApi = {
  getMe:    ()       => api.get('/users/me'),
  syncUser: (d: any) => api.post('/users/sync', d),
  list:     ()       => api.get('/users/'),
}

export const copilotApi = {
  chat: (message: string, history: any[]) =>
    api.post('/copilot/chat', { message, conversation_history: history }),
}

export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  esg:      () => api.get('/analytics/esg'),
  forecast: () => api.get('/analytics/forecast'),
}

export const adminApi = {
  policies: () => api.get('/admin/policies'),
  auditLog: () => api.get('/admin/audit-log'),
  allUsers: () => api.get('/admin/users'),
}
