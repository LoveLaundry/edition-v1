import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { appConfig } from '../config/app'
import type { Association } from './associations'
import { LaundryChoiceRequired, useAuth } from './AuthContext'

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when the same login exists under several laundries: we hold the
  // credentials and ask which one, instead of guessing and showing the wrong
  // company's figures.
  const [choices, setChoices] = useState<Association[] | null>(null)

  if (isAuthenticated) return <Navigate to="/" replace />

  const isClient = appConfig.authKind === 'client'
  const sideLabel = appConfig.clientType === 'SHOP' ? 'Shop login' : 'Hotel login'

  async function attempt(laundryId?: string) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await signIn({ username, password, laundryId })
    } catch (caught) {
      if (caught instanceof LaundryChoiceRequired) {
        setChoices(caught.laundries)
      } else {
        setError(caught instanceof Error && caught.message ? caught.message : errorMessage(caught))
      }
    } finally {
      setPending(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void attempt()
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

        {choices ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Choose a laundry</h2>
            <p className="mt-1 text-xs text-slate-500">
              This login is registered with more than one laundry. Each one keeps its own
              records.
            </p>
            <ul className="mt-4 space-y-2">
              {choices.map((choice) => (
                <li key={`${choice.laundry_id}-${choice.client_name}`}>
                  <button
                    type="button"
                    disabled={pending || choice.status.toUpperCase() !== 'ACTIVE'}
                    onClick={() => void attempt(choice.laundry_id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm transition hover:border-slate-900 disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-medium text-slate-900">
                        {choice.laundry_name || choice.laundry_id}
                      </span>
                      <span className="block text-xs text-slate-500">{choice.client_name}</span>
                    </span>
                    {choice.status.toUpperCase() !== 'ACTIVE' ? (
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {choice.status}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setChoices(null)}
              className="mt-4 text-xs font-medium text-slate-500 underline underline-offset-2"
            >
              Use a different login
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                {isClient ? sideLabel : 'Username'}
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
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
