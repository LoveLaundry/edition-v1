import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Eye,
  EyeOff as EyeSlash,
  ArrowRight,
  CircleAlert as WarningCircle,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { authService } from '../services/auth.service'
import { Logo } from '../../../components/brand/logo'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Field } from '../../../components/ui/field'

/**
 * Login — a single column form on a neutral surface.
 *
 * The error is a live region tied to the submit, so a screen reader announces a
 * failed sign-in rather than the user discovering a silent no-op. The submit
 * stays disabled until both fields have content, but `required` on the inputs
 * still guards a paste-and-submit, and the reason is stated rather than implied
 * by a greyed button.
 */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const errorRef = useRef<HTMLDivElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'signin' | 'setup'>('signin')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const switchMode = (next: 'signin' | 'setup') => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
    setDisplayName('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate here rather than disabling the button. A disabled primary action
    // tells a first-time user nothing about what is wrong, and on a fresh
    // database the setup form is the only way forward — hiding it strands them.
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    if (mode === 'setup' && password.length < 8) {
      setError('Choose a password of at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'setup') {
        if (password !== confirm) {
          setError('Passwords do not match.')
          return
        }
        const res = await authService.bootstrap({
          auth_id: username.trim(),
          user_name: displayName.trim() || username.trim(),
          password,
        })
        login(res.access_token, res.user)
        navigate(from, { replace: true })
        return
      }
      const res = await authService.login({ username: username.trim(), password })
      login(res.access_token, res.user)

      // A platform administrator has no tenant dashboards to land on.
      const platformSession =
        res.user?.platform_admin === true ||
        String(res.user?.role_id ?? '').toUpperCase() === 'PLATFORM_ADMIN'
      navigate(platformSession && from === '/' ? '/laundries' : from, { replace: true })
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status
      if (mode === 'setup' && status === 403) {
        setError('An admin already exists — sign in instead.')
      } else if (mode === 'setup' && (status === 404 || status === 405)) {
        setError('Server update is still deploying — wait a minute and try again.')
      } else {
        setError(err?.message || 'Invalid username or password')
      }
      // Put focus back where the correction happens.
      usernameRef.current?.select()
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px]"
        style={{
          background:
            'radial-gradient(58% 100% at 50% 0%, color-mix(in srgb, var(--brand) 7%, transparent), transparent 72%)',
        }}
      />
      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="route-enter rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] sm:p-7">
            <div className="mb-5">
              <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                {mode === 'setup' ? 'Create admin account' : 'Sign in'}
              </h1>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                {mode === 'setup'
                  ? 'First-time setup. Works once — afterwards sign in instead.'
                  : 'Use the account your administrator gave you.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Field
                id="username"
                label={mode === 'setup' ? 'Admin username' : 'Username or email'}
                hint={error ? undefined : mode === 'setup' ? 'At least 3 characters.' : 'Case-insensitive.'}
              >
                <Input
                  ref={usernameRef}
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="e.g. dulshan"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (error) setError('')
                  }}
                  required
                  autoFocus
                  invalid={Boolean(error)}
                  className="h-10"
                />
              </Field>

              {mode === 'setup' && (
                <Field id="displayName" label="Display name">
                  <Input
                    id="displayName"
                    name="displayName"
                    type="text"
                    autoComplete="nickname"
                    placeholder="e.g. Company Owner"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      if (error) setError('')
                    }}
                    className="h-10"
                  />
                </Field>
              )}

              <Field id="password" label={mode === 'setup' ? 'Password (min 8 characters)' : 'Password'}>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    required
                    invalid={Boolean(error)}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showPw}
                    className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-[var(--text-faint)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    {showPw ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                  </button>
                </div>
              </Field>

              {mode === 'setup' && (
                <Field id="confirm" label="Confirm password">
                  <Input
                    id="confirm"
                    name="confirm"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat the password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value)
                      if (error) setError('')
                    }}
                    required
                    invalid={Boolean(error)}
                    className="h-10"
                  />
                </Field>
              )}

              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                aria-live="assertive"
                className="empty:hidden"
              >
                {error && (
                  <div className="flex items-start gap-2 rounded border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2.5 text-[12.5px] text-[var(--danger-text)] outline-none">
                    <WarningCircle size={15} aria-hidden className="mt-px shrink-0" />
                    <span className="min-w-0 flex-1">{error}</span>
                  </div>
                )}
              </div>

              <Button
                id="login-submit"
                type="submit"
                variant="primary"
                loading={loading}
                className="mt-2 w-full"
                size="lg"
              >
                {loading ? (mode === 'setup' ? 'Creating admin' : 'Signing in') : mode === 'setup' ? 'Create admin & sign in' : 'Sign in'}
              </Button>

              <p className="pt-1 text-center text-[11.5px] text-[var(--text-faint)]">
                {mode === 'setup' ? (
                  <>
                    Already set up?{' '}
                    <button type="button" onClick={() => switchMode('signin')} className="font-medium text-[var(--brand-text)] hover:underline">
                      Sign in instead
                    </button>
                  </>
                ) : (
                  <>
                    First time here?{' '}
                    <button type="button" onClick={() => switchMode('setup')} className="font-medium text-[var(--brand-text)] hover:underline">
                      Create the admin account
                    </button>
                  </>
                )}
              </p>

              {mode === 'signin' && (
                <p className="pt-1 text-center text-[11.5px] text-[var(--text-faint)]">
                  Password forgotten? Ask an administrator to reset it.
                </p>
              )}
            </form>
          </div>

          {/* Guest pass is a different audience, not a lesser login: it is a
              separate surface with its own purpose, so it sits outside the
              credential card. */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/guest/shop')}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left transition-colors duration-100 hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-[var(--text-primary)]">
                  Guest bill pass
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[var(--text-muted)]">
                  Look up a bill with a pass code — no account needed.
                </span>
              </span>
              <ArrowRight
                size={16}
                aria-hidden
                className="shrink-0 text-[var(--text-faint)] transition-colors group-hover:text-[var(--text-tertiary)]"
              />
            </button>
          </div>
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-[11px] text-[var(--text-faint)]">
        Love Laundry · Operations system
      </footer>
    </div>
  )
}
