/**
 * Generates the three new apps from one template.
 *
 * Why a generator instead of three hand-written scaffolds: the apps must never
 * drift apart in auth, error handling or routing. One template means one place
 * to change, and the three repos stay byte-identical except for their config.
 *
 *   node scaffold-apps.mjs <target-directory>
 *
 * Each generated app is a standalone Vite + React + TS project with:
 *   · namespaced session storage (no key collisions with quotations-ui)
 *   · a guarded router
 *   · staff or client sign-in, chosen per app
 *   · typed API clients pointed at the real services
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const target = process.argv[2]
if (!target) {
  console.error('usage: node scaffold-apps.mjs <target-directory>')
  process.exit(1)
}

const apps = [
  {
    dir: 'shop-app',
    name: 'shop-counter',
    title: 'Shop Counter',
    tagline: 'Billing and day close for shop customers',
    port: 5174,
    storageKey: 'll_shop_session',
    authKind: 'staff',
    accent: '#2563eb',
    deployDomain: 'shop.lovelaundry.lk',
    nav: [
      {
        path: '/',
        label: 'Today',
        endpoint: 'GET /shop-bills/stats/overview',
        blurb: 'Open bills, takings and what is waiting at the counter.',
      },
      {
        path: '/bills',
        label: 'Bills',
        endpoint: 'GET /shop-bills',
        blurb: 'Every shop bill with status, client and balance.',
      },
      {
        path: '/quick-bill',
        label: 'Quick bill',
        endpoint: 'POST /shop-bills/quick-bill',
        blurb: 'Counter sale in a few taps, no customer record required.',
      },
      {
        path: '/day-close',
        label: 'Day close',
        endpoint: 'GET /day-close',
        blurb: 'Cash counted against what the system recorded.',
      },
    ],
  },
  {
    dir: 'hotel-app',
    name: 'hotel-desk',
    title: 'Hotel Desk',
    tagline: 'Your account with Love Laundry',
    port: 5175,
    storageKey: 'll_hotel_session',
    authKind: 'client',
    accent: '#0f766e',
    deployDomain: 'hotel.lovelaundry.lk',
    nav: [
      {
        path: '/',
        label: 'Overview',
        endpoint: 'GET /client-portal/summary',
        blurb: 'This month at a glance: pieces in, pieces out, amount due.',
      },
      {
        path: '/gate-passes',
        label: 'Gate passes',
        endpoint: 'GET /client-portal/gate-passes',
        blurb: 'Every collection from your property, with piece counts.',
      },
      {
        path: '/deliveries',
        label: 'Deliveries',
        endpoint: 'GET /client-portal/deliveries',
        blurb: 'What came back, when, and what was short.',
      },
      {
        path: '/invoices',
        label: 'Invoices',
        endpoint: 'GET /client-portal/bills',
        blurb: 'Invoices and their settlement status.',
      },
    ],
  },
  {
    dir: 'linen-room-app',
    name: 'linen-room',
    title: 'Linen Room',
    tagline: 'Scan in, scan out, keep the count honest',
    port: 5176,
    storageKey: 'll_linen_session',
    authKind: 'staff',
    accent: '#7c3aed',
    deployDomain: 'linen.lovelaundry.lk',
    nav: [
      {
        path: '/',
        label: 'Scan',
        endpoint: 'POST /linens/{id}/scan',
        blurb: 'Camera or gun scanner: collect, receive, ready, deliver.',
      },
      {
        path: '/inventory',
        label: 'Inventory',
        endpoint: 'GET /linens',
        blurb: 'Where every tagged piece is right now.',
      },
      {
        path: '/discrepancies',
        label: 'Discrepancies',
        endpoint: 'GET /linens/stats/summary',
        blurb: 'Missing and damaged pieces that need a decision.',
      },
      {
        path: '/tags',
        label: 'Tags',
        endpoint: 'POST /linens/generate-tags',
        blurb: 'Print new tags for pieces entering circulation.',
      },
    ],
  },
]

const json = (value) => JSON.stringify(value, null, 2) + '\n'

function files(app) {
  const isClient = app.authKind === 'client'
  const loginPath = isClient ? '/client/auth/login' : '/auth/login'
  const statusPath = isClient ? '/client/auth/status' : '/auth/status'

  return {
    'package.json': json({
      name: app.name,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc --noEmit && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        axios: '^1.19.0',
        clsx: '^2.1.1',
        react: '^19.2.8',
        'react-dom': '^19.2.8',
        'react-router-dom': '^7.18.2',
      },
      devDependencies: {
        '@tailwindcss/vite': '^4.3.3',
        '@types/react': '^19.2.17',
        '@types/react-dom': '^19.2.3',
        '@vitejs/plugin-react': '^6.0.4',
        tailwindcss: '^4.3.3',
        typescript: '~6.0.2',
        vite: '^8.2.0',
      },
    }),

    'tsconfig.json': json({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        isolatedModules: true,
        verbatimModuleSyntax: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        types: ['vite/client'],
      },
      include: ['src'],
    }),

    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: ${app.port},
    // Two apps open at once must not fight over the same port.
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('axios')) return 'vendor-http'
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
`,

    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${app.accent}" />
    <title>${app.title} — Love Laundry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

    '.gitignore': `node_modules
dist
.env
.env.local
*.local
.DS_Store
.vite
`,

    '.env.example': `# user-service: sign-in and session validation
VITE_USER_API_URL=http://localhost:8002
# bill_service: operational data
VITE_BILL_API_URL=http://localhost:8001
`,

    'vercel.json': json({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    }),

    'README.md': `# ${app.title}

${app.tagline}. Standalone app for ${isClient ? 'hotel customers' : 'our own staff'};
it talks to the existing services and owns no data of its own.

- **Deploy target:** ${app.deployDomain}
- **Dev port:** ${app.port}
- **Sign-in:** \`POST ${loginPath}\`
- **Session storage:** \`${app.storageKey}\` (namespaced — never shared with another app)

## Rules this app must keep

1. The tenant comes from the JWT only, never from a URL, body or query string.
2. Money is computed by \`bill_service\`. This app never re-adds totals.
3. Nothing is written to a new collection. If the API cannot do it, the API is
   extended first.

## Run

\`\`\`bash
npm install
npm run dev     # http://localhost:${app.port}
npm run build   # tsc --noEmit && vite build
\`\`\`
`,

    'src/vite-env.d.ts': `/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USER_API_URL?: string
  readonly VITE_BILL_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
`,

    'src/session.ts': `/**
 * Session storage for this app only.
 *
 * Each app uses its own key (\`${app.storageKey}\`) instead of the shared
 * \`ll_token\` used by the laundry app. If two apps are ever served from one
 * host, neither can read the other's session or hand a token to the wrong API.
 */
export interface SessionUser {
  name: string
  role: string
  laundry?: string
  /** Hotel name — only ever set for client sessions. */
  clientName?: string
}

export interface Session {
  token: string
  user: SessionUser
}

const KEY = '${app.storageKey}'

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.token || !parsed?.user) return null
    return parsed
  } catch {
    return null
  }
}

export function writeSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}

export function getToken(): string | null {
  return readSession()?.token ?? null
}

/** True when the JWT has already expired, so the UI can drop it before a 401. */
export function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
    return typeof payload?.exp === 'number' && payload.exp * 1000 < Date.now()
  } catch {
    return false
  }
}
`,

    'src/api/client.ts': `import axios from 'axios'
import { clearSession, getToken } from '../session'

/** Sign-in, session status, and hotel client auth. */
export const authApi = axios.create({
  baseURL: import.meta.env.VITE_USER_API_URL ?? 'http://localhost:8002',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

/** Operational data (bills, gate passes, linens, ...). */
export const dataApi = axios.create({
  baseURL: import.meta.env.VITE_BILL_API_URL ?? 'http://localhost:8001',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

for (const instance of [authApi, dataApi]) {
  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = \`Bearer \${token}\`
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
      return Promise.reject(error)
    },
  )
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.'
    if (!error.response) return 'Cannot reach the server. Check your connection.'
  }
  return 'Something went wrong. Try again.'
}
`,

    'src/config/app.ts': `export interface NavItem {
  path: string
  label: string
  /** The real endpoint this screen will consume. */
  endpoint: string
  blurb: string
}

export const appConfig = {
  title: '${app.title}',
  tagline: '${app.tagline}',
  authKind: '${app.authKind}' as 'staff' | 'client',
  /** ${loginPath} — the only sign-in this app may call. */
  loginPath: '${loginPath}',
  statusPath: '${statusPath}',
  nav: ${JSON.stringify(app.nav, null, 2).replace(/\n/g, '\n  ')} as NavItem[],
}
`,

    'src/auth/AuthContext.tsx': `import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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

interface SignInInput {
  username: string
  password: string
}

interface AuthValue {
  session: Session | null
  user: SessionUser | null
  isAuthenticated: boolean
  signIn: (input: SignInInput) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

/** Shape a staff \`/auth/login\` response. */
function staffUser(user: Record<string, unknown>): SessionUser {
  return {
    name: String(user.user_name ?? user.auth_id ?? 'Staff'),
    role: String(user.role_id ?? user.role ?? '').toUpperCase(),
    laundry: user.laundry_id ? String(user.laundry_id) : undefined,
  }
}

/** Shape a hotel \`/client/auth/login\` response. */
function clientUser(client: Record<string, unknown>): SessionUser {
  return {
    name: String(client.user_name ?? client.auth_id ?? 'Hotel'),
    role: String(client.role_id ?? '').toUpperCase(),
    laundry: client.laundry_id ? String(client.laundry_id) : undefined,
    clientName: client.client_name ? String(client.client_name) : undefined,
  }
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

  const signOut = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const signIn = useCallback(async ({ username, password }: SignInInput) => {
    const isClient = appConfig.authKind === 'client'
    const body = isClient
      ? { auth_id: username.trim(), password }
      : { username: username.trim(), password }

    const { data } = await authApi.post(appConfig.loginPath, body)
    const user = isClient
      ? clientUser(data.client as Record<string, unknown>)
      : staffUser(data.user as Record<string, unknown>)

    // A hotel session must never be stored without knowing which hotel it is:
    // every query is filtered by that name, so an empty one would silently
    // return nothing (or, worse, be trusted as a wildcard by a future endpoint).
    if (isClient && !user.clientName) {
      throw new Error('This account is not linked to a hotel. Contact your provider.')
    }

    const next: Session = { token: String(data.access_token), user }
    writeSession(next)
    setSession(next)
  }, [])

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
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
`,

    'src/auth/LoginPage.tsx': `import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { appConfig } from '../config/app'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated) return <Navigate to="/" replace />

  const isClient = appConfig.authKind === 'client'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await signIn({ username, password })
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Love Laundry
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{appConfig.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{appConfig.tagline}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {isClient ? 'Hotel login' : 'Username'}
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? 'Signing in\\u2026' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
`,

    'src/shell/AppShell.tsx': `import { NavLink, Outlet } from 'react-router-dom'
import { appConfig } from '../config/app'
import { useAuth } from '../auth/AuthContext'
import clsx from 'clsx'

export function AppShell() {
  const { user, signOut } = useAuth()
  const scope = user?.clientName ?? user?.laundry

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{appConfig.title}</p>
            {scope ? <p className="truncate text-xs text-slate-500">{scope}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user?.name}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{user?.role}</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
              aria-label="Sign out"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {appConfig.nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/70',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
`,

    'src/pages/SectionPage.tsx': `import type { NavItem } from '../config/app'

/**
 * Placeholder for a screen that is not built yet.
 *
 * It deliberately shows the endpoint the screen will call instead of fake
 * sample data: a mock total on a money screen is indistinguishable from a real
 * one, and someone would eventually act on it.
 */
export function SectionPage({ item }: { item: NavItem }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-lg font-semibold">{item.label}</h1>
      <p className="mt-1 max-w-prose text-sm text-slate-600">{item.blurb}</p>

      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Screen not built yet
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Will read from{' '}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs text-white">
            {item.endpoint}
          </code>
        </p>
      </div>
    </section>
  )
}
`,

    'src/App.tsx': `import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { AppShell } from './shell/AppShell'
import { SectionPage } from './pages/SectionPage'
import { appConfig } from './config/app'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function Router() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        {appConfig.nav.map((item) => (
          <Route key={item.path} path={item.path} element={<SectionPage item={item} />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </BrowserRouter>
  )
}
`,

    'src/main.tsx': `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,

    'src/index.css': `@import 'tailwindcss';

@theme {
  --color-brand: ${app.accent};
}

html,
body,
#root {
  height: 100%;
}

body {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
`,
  }
}

for (const app of apps) {
  const root = join(target, app.dir)
  const entries = Object.entries(files(app))

  for (const [relative, content] of entries) {
    const file = join(root, relative)
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, content, 'utf8')
  }

  console.log(`${app.dir}: ${entries.length} files`)
}
