import authApi from '../../../api/auth-api'
import type { User } from '../../../types/auth'

interface LoginPayload {
    username: string
    password: string
}

interface LoginResponse {
    access_token: string
    token_type: string
    user: User
}

export const authService = {
    login: (payload: LoginPayload): Promise<LoginResponse> =>
        authApi.post<LoginResponse>('/auth/login', payload).then((r: any) => r.data),

    /** First admin on a fresh system. Server refuses (403) once users exist. */
    bootstrap: (payload: { auth_id: string; user_name: string; password: string }): Promise<LoginResponse> =>
        authApi.post<LoginResponse>('/auth/bootstrap', payload).then((r: any) => r.data),

    getStatus: (): Promise<User> =>
        authApi.get<User>('/auth/status').then((r: any) => r.data),
}
