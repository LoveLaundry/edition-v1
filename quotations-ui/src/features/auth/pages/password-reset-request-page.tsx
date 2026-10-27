import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { toast } from 'sonner'

export function PasswordResetRequestPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    try {
      const response = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        throw new Error('Failed to request password reset')
      }

      setSuccess(true)
      toast.success('Password reset email sent')
    } catch (error) {
      toast.error('Failed to request password reset. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Check your email</h2>
                <p className="mt-2 text-slate-600">
                  We've sent a password reset link to <span className="font-medium">{email}</span>
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  The link will expire in 1 hour. Please check your spam folder if you don't see it.
                </p>
              </div>
              <Button
                onClick={() => setSuccess(false)}
                variant="outline"
                className="w-full"
              >
                Request another reset
              </Button>
              <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 underline">
                Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link to="/login" className="flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to login
          </Link>
          <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
          <p className="text-slate-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-slate-500 text-center">
            Don't have an account?{' '}
            <Link to="/register" className="text-slate-900 font-medium hover:underline">
              Contact your administrator
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
