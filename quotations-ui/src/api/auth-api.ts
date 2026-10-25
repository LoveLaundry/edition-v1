import axios from 'axios'
import { getActiveToken } from '../lib/auth-token'
import { attachResponseInterceptor } from './interceptors'

const authApi = axios.create({
  baseURL: import.meta.env.VITE_USER_API_URL ?? 'http://localhost:8002',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

authApi.interceptors.request.use((config) => {
  const token = getActiveToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

attachResponseInterceptor(authApi)

export default authApi
