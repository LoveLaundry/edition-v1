import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  getActiveToken: vi.fn<() => string | null>(() => 'user.jwt.token'),
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({ get: mocks.get, post: mocks.post }),
  },
}))

vi.mock('../../../lib/auth-token', () => ({
  getActiveToken: mocks.getActiveToken,
}))

let loveAi: typeof import('./ai-api')['loveAi']

async function dataHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

describe('Love AI authentication and response integrity', () => {
  beforeAll(async () => {
    vi.stubEnv('VITE_AI_API_URL', 'https://love-ai.example')
    ;({ loveAi } = await import('./ai-api'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActiveToken.mockReturnValue('user.jwt.token')
  })

  it('sends the signed-in JWT only and verifies the insight envelope', async () => {
    const data = { total_revenue: 1200 }
    mocks.get.mockResolvedValue({
      data: { data, data_hash: await dataHash(data), source: 'test', verified: false },
    })

    const result = await loveAi.dashboard(6)

    expect(mocks.get).toHaveBeenCalledWith(
      '/api/ai/insights/dashboard?months=6',
      { headers: { Authorization: 'Bearer user.jwt.token' } },
    )
    expect(result).toMatchObject({ data, verified: true })
  })

  it('does not send an insight request without a signed-in JWT', async () => {
    mocks.getActiveToken.mockReturnValue(null)

    await expect(loveAi.dashboard()).rejects.toThrow('Sign in to access AI insights.')
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('rejects an insight response with a mismatched data hash', async () => {
    mocks.get.mockResolvedValue({
      data: { data: { total_revenue: 1200 }, data_hash: 'bad-hash', source: 'test', verified: false },
    })

    await expect(loveAi.dashboard()).rejects.toThrow('data hash mismatch')
  })

  it('rejects an insight response without a data hash', async () => {
    mocks.get.mockResolvedValue({
      data: { data: { total_revenue: 1200 }, source: 'test', verified: false },
    })

    await expect(loveAi.dashboard()).rejects.toThrow('invalid response envelope')
  })
})
