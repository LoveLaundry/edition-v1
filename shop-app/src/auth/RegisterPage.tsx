import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { appConfig } from '../config/app'

export function RegisterPage() {
  const [formData, setFormData] = useState({
    auth_id: '',
    user_name: '',
    password: '',
    confirmPassword: '',
    email: '',
    client_name: '',
    laundry_id: '',
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-center">
              <p className="text-sm font-semibold text-green-600">Registration Successful!</p>
              <p className="mt-2 text-sm text-slate-600">
                Your account has been created. Please sign in to continue.
              </p>
            </div>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </main>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch(`${import.meta.env.VITE_USER_API_URL ?? '/api/user'}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_id: formData.auth_id.trim(),
          user_name: formData.user_name.trim(),
          password: formData.password,
          email: formData.email.trim() || null,
          client_name: formData.client_name.trim(),
          client_type: appConfig.clientType,
          laundry_id: formData.laundry_id.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Registration failed')
      }

      setSuccess(true)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Love Laundry
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {appConfig.clientType === 'SHOP' ? 'Shop Registration' : 'Hotel Registration'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Create your account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Username</span>
            <input
              type="text"
              value={formData.auth_id}
              onChange={(e) => handleChange('auth_id', e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={64}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Full Name</span>
            <input
              type="text"
              value={formData.user_name}
              onChange={(e) => handleChange('user_name', e.target.value)}
              autoComplete="name"
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {appConfig.clientType === 'SHOP' ? 'Shop Name' : 'Hotel Name'}
            </span>
            <input
              type="text"
              value={formData.client_name}
              onChange={(e) => handleChange('client_name', e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email (Optional)</span>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              autoComplete="email"
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Laundry ID (Optional)</span>
            <input
              type="text"
              value={formData.laundry_id}
              onChange={(e) => handleChange('laundry_id', e.target.value)}
              maxLength={32}
              placeholder="If provided by your laundry provider"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Confirm Password</span>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
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
            {pending ? 'Creating Account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-slate-900 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
