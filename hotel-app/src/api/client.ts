import axios from 'axios'
import { clearSession, getToken } from '../session'

/** Sign-in, session status, and hotel client auth. */
export const authApi = axios.create({
  // Same origin in production: nginx proxies /api/user to user-service.
  baseURL: import.meta.env.VITE_USER_API_URL ?? '/api/user',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

/** Operational data (bills, gate passes, linens, ...). */
export const dataApi = axios.create({
  // Same origin in production: nginx proxies /api/bills to bill_service.
  baseURL: import.meta.env.VITE_BILL_API_URL ?? '/api/bills',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

for (const instance of [authApi, dataApi]) {
  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      // Only 401 means "this session is gone". A 403 means the account exists
      // but may not do this — dropping the session there would sign out a user
      // for opening a page they were never allowed to see.
      if (status === 401) {
        clearSession()
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login')
        }
      }
      // Log network errors for debugging
      if (!error.response) {
        console.error('Network error:', error.message)
      }
      return Promise.reject(error)
    },
  )
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.'
    if (error.code === 'ECONNREFUSED') return 'Cannot reach the server. It may be down.'
    if (!error.response) return 'Cannot reach the server. Check your connection.'
    const status = error.response?.status
    if (status === 429) return 'Too many requests. Please wait and try again.'
    if (status === 500) return 'Server error. Please try again later.'
    if (status === 503) return 'Service temporarily unavailable. Please try again later.'
  }
  return 'Something went wrong. Try again.'
}
