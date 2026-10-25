import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { User } from '../types/auth'
import { deleteCacheDb } from '../cache/db'
import { cacheScopeFor } from '../cache/scope'
import { setSupportToken } from '../lib/auth-token'
import authApi from '../api/auth-api'

export interface SupportSession {
    token: string
    user: User
    laundryId: string
    laundryName: string
}

interface AuthCtx {
    token: string | null
    user: User | null
    setUser: (user: User) => void
    login: (token: string, user: User) => void
    logout: () => void
    /** Swap the active laundry for a multi-laundry user. */
    switchLaundry: (laundryId: string) => Promise<void>
    isAuthenticated: boolean
    /** Audited platform support entry (short-lived, memory-only). */
    support: SupportSession | null
    enterSupport: (session: SupportSession) => void
    exitSupport: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('ll_token'))
    const [support, setSupport] = useState<SupportSession | null>(null)
    const [user, setUser] = useState<User | null>(() => {
        try { return JSON.parse(localStorage.getItem('ll_user') ?? 'null') } catch { return null }
    })

    const login = useCallback((tok: string, usr: User) => {
        localStorage.setItem('ll_token', tok)
        localStorage.setItem('ll_user', JSON.stringify(usr))
        setToken(tok)
        setUser(usr)
    }, [])

    const logout = useCallback(() => {
        const scope = user?.id
        localStorage.removeItem('ll_token')
        localStorage.removeItem('ll_user')
        setSupportToken(null)
        setSupport(null)
        setToken(null)
        setUser(null)
        // Drop that user's local_cache_db so the next sign-in starts clean —
        // never leak one account's cached data into another's session.
        if (scope) void deleteCacheDb(cacheScopeFor(user))
    }, [user])

    const updateUser = useCallback((usr: User) => {
        if (!support) localStorage.setItem('ll_user', JSON.stringify(usr))
        setUser(usr)
    }, [support])

    const switchLaundry = useCallback(
        async (laundryId: string) => {
            const previous = user
            const res = await authApi.post('/auth/laundry', { laundry_id: laundryId })
            const { access_token, user: nextUser } = res.data as {
                access_token: string
                token_type: string
                user: User
            }
            localStorage.setItem('ll_token', access_token)
            localStorage.setItem('ll_user', JSON.stringify(nextUser))
            setToken(access_token)
            setUser(nextUser)
            if (previous) void deleteCacheDb(cacheScopeFor(previous))
        },
        [user],
    )

    // Platform support entry: the admin's own session stays stored; the
    // support token lives only in memory, so a reload always drops back to
    // the platform session instead of stranding anyone in support mode.
    const enterSupport = useCallback((session: SupportSession) => {
        setSupportToken(session.token)
        setSupport(session)
        setToken(session.token)
        setUser(session.user)
    }, [])

    const exitSupport = useCallback(() => {
        // Drop the support session's cached data — it must never linger for
        // the next person on this device.
        if (support) void deleteCacheDb(cacheScopeFor(support.user))
        setSupportToken(null)
        setSupport(null)
        setToken(localStorage.getItem('ll_token'))
        try {
            setUser(JSON.parse(localStorage.getItem('ll_user') ?? 'null'))
        } catch {
            setUser(null)
        }
    }, [support])

    // Proactively detect an expired JWT so the user is sent to login cleanly
    // instead of hitting a silent 401 on the first data request.
    useEffect(() => {
        if (!token) return
        try {
            const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
            if (payload?.exp && payload.exp * 1000 < Date.now()) {
                logout()
            }
        } catch {
            // Malformed token — leave it; the API will reject and trigger logout.
        }
    }, [token, logout])

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                setUser: updateUser,
                login,
                logout,
                switchLaundry,
                isAuthenticated: !!token,
                support,
                enterSupport,
                exitSupport,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
