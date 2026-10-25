export interface User {
    id: string
    user_name: string
    auth_id: string
    role_id: string
    status: string
    email?: string
    mobile_number?: string
    bio_data?: string
    user_dp?: string
    employee_id?: string
    permissions?: string | null
    laundry_id?: string | null
    laundries?: { id: string; role: string; status: string }[] | null
    platform_admin?: boolean | null
}

export interface Laundry {
    id: string | number
    laundry_id: string
    name: string
    br_number?: string | null
    location?: string | null
    address?: string | null
    contact_number?: string | null
    email?: string | null
    logo_url?: string | null
    icon?: string | null
    description?: string | null
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | string
    subscription_plan?: string | null
    plan_limits?: string | null
    created_by?: string | null
    created_at?: string | null
    updated_at?: string | null
}

export interface LaundryMembership {
    id: string | number
    auth_id: string
    laundry_id: string
    role: string
    status: string
    created_at?: string | null
    updated_at?: string | null
}

export interface AuthState {
    token: string | null
    user: User | null
}
