import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import axios from 'axios'
import { authApi } from '../api/client'
import { appConfig } from '../config/app'
import {
  clearSession,
  isExpired,
  readSession,
  writeSession,
  type Session,
  type SessionUser,
} from '../session'
import { loadAssociations, switchLaundry as switchLaundryRequest, type Association } from './associations'

interface SignInInput {
  username: string
  password: string
  /** Required only when the same login exists in more than one laundry. */
  laundryId?: string
}

/** Raised when a login belongs to several laundries and one must be chosen. */
export class LaundryChoiceRequired extends Error {
  laundries: Association[]
  constructor(laundries: Association[]) {
    super('This login is registered with more than one laundry.')
    this.name = 'LaundryChoiceRequired'
    this.laundries = laundries
  }
}

interface AuthValue {
  session: Session | null
  user: SessionUser | null
  isAuthenticated: boolean
  laundries: Association[]
  currentLaundry: string | undefined
  signIn: (input: SignInInput) => Promise<void>
  switchLaundry: (laundryId: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

/** Shape a staff `/auth/login` response. */
function staffUser(user: Record<string, unknown>): SessionUser {
  return {
    name: String(user.user_name ?? user.auth_id ?? 'Staff'),
    role: String(user.role_id ?? user.role ?? '').toUpperCase(),
    laundry: user.laundry_id ? String(user.laundry_id) : undefined,
  }
}

/** Shape a client `/client/auth/login` response. */
function clientUser(client: Record<string, unknown>): SessionUser {
  return {
    name: String(client.user_name ?? client.auth_id ?? 'Client'),
    role: String(client.role_id ?? '').toUpperCase(),
    laundry: client.laundry_id ? String(client.laundry_id) : undefined,
    clientName: client.client_name ? String(client.client_name) : undefined,
  }
}

/** Pull the laundry choices out of a 409 from the login endpoint. */
function laundryChoicesFrom(error: unknown): Association[] | null {
  if (!axios.isAxiosError(error)) return null
  if (error.response?.status !== 409) return null
  const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
  if (!detail || typeof detail !== 'object') return null
  const payload = detail as { code?: string; laundries?: unknown }
  if (payload.code !== 'laundry_required' || !Array.isArray(payload.laundries)) return null
  return payload.laundries as Association[]
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = readSession()
    if (stored && isExpired(stored.token)) {
      clearSession()
      return null
    }
    return stored
  })
  const [laundries, setLaundries] = useState<Association[]>([])

  const signOut = useCallback(() => {
    clearSession()
    setSession(null)
    setLaundries([])
  }, [])

  const signIn = useCallback(async ({ username, password, laundryId }: SignInInput) => {
    const isClient = appConfig.authKind === 'client'
    const body = isClient
      ? {
          auth_id: username.trim(),
          password,
          // Sending the side keeps a shop login and a hotel login that share a
          // username from being treated as ambiguous with each other.
          client_type: appConfig.clientType,
          ...(laundryId ? { laundry_id: laundryId } : {}),
        }
      : { username: username.trim(), password }

    let data: Record<string, unknown>
    try {
      const response = await authApi.post(appConfig.loginPath, body)
      data = response.data as Record<string, unknown>
    } catch (caught) {
      const choices = laundryChoicesFrom(caught)
      if (choices) throw new LaundryChoiceRequired(choices)
      throw caught
    }

    const user = isClient
      ? clientUser(data.client as Record<string, unknown>)
      : staffUser(data.user as Record<string, unknown>)

    // A client session must never be stored without knowing which account it
    // is: every query is filtered by that name, so an empty one would silently
    // return nothing (or, worse, be trusted as a wildcard by a future endpoint).
    if (isClient && !user.clientName) {
      throw new Error('This account is not linked to a customer record. Contact your provider.')
    }

    const next: Session = { token: String(data.access_token), user }
    writeSession(next)
    setSession(next)
  }, [])

  const switchLaundry = useCallback(async (laundryId: string) => {
    const next = await switchLaundryRequest(laundryId)
    writeSession(next)
    setSession(next)
  }, [])

  // Which laundries this login can reach. Only clients can be associated with
  // more than one, so staff sessions skip the call entirely.
  useEffect(() => {
    if (!session || appConfig.authKind !== 'client') {
      setLaundries([])
      return
    }
    let cancelled = false
    loadAssociations()
      .then((items) => {
        if (!cancelled) setLaundries(items)
      })
      .catch(() => {
        if (!cancelled) setLaundries([])
      })
    return () => {
      cancelled = true
    }
  }, [session?.token])

  // Confirm the stored session is still valid server-side. A 401 clears it via
  // the interceptor; a 403 (suspended account) must also end the session.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    authApi
      .get(appConfig.statusPath)
      .catch((error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (!cancelled && (status === 401 || status === 403)) signOut()
      })
    return () => {
      cancelled = true
    }
    // Run once per token, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      laundries,
      currentLaundry: session?.user?.laundry,
      signIn,
      switchLaundry,
      signOut,
    }),
    [session, laundries, signIn, switchLaundry, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
