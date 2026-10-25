import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    RiUserAddLine, RiCloseLine, RiEyeLine, RiEyeOffLine,
    RiRefreshLine, RiShieldCheckLine, RiEditLine, RiBuilding2Line,
    RiUserFollowLine, RiUserUnfollowLine, RiCheckLine
} from 'react-icons/ri'
import { toast } from 'sonner'
import authApi from '../../../api/auth-api'
import { laundryService } from '../../platform/services/laundry.service'
import { useAuth } from '../../../context/AuthContext'
import type { Laundry, LaundryMembership } from '../../../types/auth'
import { EmptyState } from '../../../components/ui/empty-state'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { Portal } from '../../../components/ui/portal'
import { useEscape } from '../../../hooks/use-escape'

interface UserForm {
    user_name: string
    auth_id: string
    password: string
    email: string
    mobile_number: string
    employee_id: string
    role_id: string
    status: string
    laundry_id: string
}

const ROLES = ['ADMIN', 'MANAGER', 'STAFF']
const TENANT_ROLES = ['ADMIN', 'MANAGER', 'STAFF']
const STATUSES = ['active', 'inactive', 'unset']

const emptyForm: UserForm = {
    user_name: '',
    auth_id: '',
    password: '',
    email: '',
    mobile_number: '',
    employee_id: '',
    role_id: 'STAFF',
    status: 'active',
    laundry_id: '',
}

interface UserRecord {
    id: string
    user_name: string
    auth_id: string
    email?: string
    mobile_number?: string
    employee_id?: string
    role_id: string
    status: string
    laundry_id?: string | null
    platform_admin?: boolean | null
    created_at?: string
}

interface Membership {
    laundry_id: string
    name: string
    role: string
}

function buildMembershipMap(
    laundries: Laundry[],
    results: { data?: LaundryMembership[] }[],
): Map<string, Membership[]> {
    const map = new Map<string, Membership[]>()
    laundries.forEach((l, idx) => {
        const members = results[idx]?.data ?? []
        for (const m of members) {
            const list = map.get(m.auth_id) ?? []
            list.push({ laundry_id: l.laundry_id, name: l.name, role: m.role })
            map.set(m.auth_id, list)
        }
    })
    return map
}

export default function UsersPage() {
    const { user: currentUser } = useAuth()
    const isPlatformAdmin =
        currentUser?.role_id?.toUpperCase() === 'PLATFORM_ADMIN' || currentUser?.platform_admin === true

    const [users, setUsers] = useState<UserRecord[]>([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState<UserForm>(emptyForm)
    const [submitting, setSubmitting] = useState(false)
    const [showPw, setShowPw] = useState(false)
    const [manageUser, setManageUser] = useState<UserRecord | null>(null)
    const flow = useEnterFlow()

    useEscape(showModal, () => setShowModal(false))

    // Platform registries — only fetched for super admins.
    const { data: platformLaundriesData } = useQuery({
        queryKey: ['platform-laundries'],
        queryFn: () => laundryService.list({ limit: 200 }),
        enabled: isPlatformAdmin,
    })
    const platformLaundries = platformLaundriesData?.items ?? []

    const { data: activeLaundriesData } = useQuery({
        queryKey: ['platform-laundries', 'ACTIVE'],
        queryFn: () => laundryService.list({ status: 'ACTIVE', limit: 200 }),
        enabled: isPlatformAdmin,
    })
    const activeLaundries = activeLaundriesData?.items ?? []

    // Every laundry's membership list, fetched in parallel, folded into a
    // map keyed by auth_id so each user row can show its memberships.
    const memberQueries = useQueries({
        queries: platformLaundries.map(l => ({
            queryKey: ['platform-laundry-members', l.laundry_id],
            queryFn: () => laundryService.members(l.laundry_id),
            enabled: isPlatformAdmin,
        })),
    })
    const membershipMap = buildMembershipMap(platformLaundries, memberQueries)
    const membersLoading = memberQueries.some(q => q.isLoading)

    const fetchUsers = async () => {
        setLoadingUsers(true)
        try {
            const res = await authApi.get<UserRecord[]>('/users')
            setUsers(res.data)
        } catch (err: any) {
            toast.error(err.message || 'Failed to load users')
        } finally {
            setLoadingUsers(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.user_name || !form.auth_id) {
            toast.error('Full name and Username are required')
            return
        }
        if (!editId && !form.password) {
            toast.error('Password is required for new users')
            return
        }
        setSubmitting(true)
        try {
            const payload: any = {
                user_name: form.user_name,
                auth_id: form.auth_id,
                role_id: form.role_id,
                status: form.status,
            }
            if (form.email) payload.email = form.email
            if (form.mobile_number) payload.mobile_number = form.mobile_number
            if (form.employee_id) payload.employee_id = form.employee_id
            // Only platform admins may enroll into a tenant, and a platform
            // admin account is never a tenant member.
            if (!editId && isPlatformAdmin && form.laundry_id && form.role_id !== 'PLATFORM_ADMIN') {
                payload.laundry_id = form.laundry_id
            }

            if (editId) {
                await authApi.put(`/users/${editId}`, payload)
                if (form.password) {
                    await authApi.patch(`/users/${editId}/password`, { password: form.password })
                }
                toast.success(`User "${form.user_name}" updated successfully`)
            } else {
                await authApi.post('/users', { ...payload, password: form.password })
                toast.success(`User "${form.user_name}" created successfully`)
            }
            setShowModal(false)
            setForm(emptyForm)
            setEditId(null)
            fetchUsers()
        } catch (err: any) {
            toast.error(err.message || `Failed to ${editId ? 'update' : 'create'} user`)
        } finally {
            setSubmitting(false)
        }
    }

    const openModal = () => {
        setForm(emptyForm)
        setEditId(null)
        setShowPw(false)
        setShowModal(true)
    }

    const openEdit = (u: UserRecord) => {
        setForm({
            user_name: u.user_name,
            auth_id: u.auth_id,
            password: '',
            email: u.email || '',
            mobile_number: u.mobile_number || '',
            employee_id: u.employee_id || '',
            role_id: (u.role_id || 'STAFF').toUpperCase(),
            status: (u.status || 'active').toLowerCase(),
            laundry_id: u.laundry_id || '',
        })
        setEditId(u.id)
        setShowPw(false)
        setShowModal(true)
    }

    const roleOptions = isPlatformAdmin ? [...ROLES, 'PLATFORM_ADMIN'] : ROLES

    const inputClass =
        'h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 text-[13px] text-[var(--text-primary)] placeholder:text-[#98A2B3] outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)] transition-all duration-150'

    const roleColor: Record<string, string> = {
        ADMIN: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
        MANAGER: 'bg-[#EDE9FE] text-[#5B21B6] border-[#DDD6FE]',
        STAFF: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
        PLATFORM_ADMIN: 'bg-[var(--text-primary)] text-white border-[var(--text-primary)]',
    }

    const statusColor: Record<string, string> = {
        active: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
        inactive: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
        unset: 'bg-[var(--surface-3)] text-[#6B7280] border-[var(--border)]',
    }

    return (
        <div className="space-y-5 pb-10 select-none">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Users' }]} />
                    <h1 className="text-dashboard-title mt-1">User Management</h1>
                    <p className="text-[13px] text-[#98A2B3] mt-0.5">
                        {isPlatformAdmin ? 'Manage users and laundry admins across every laundry' : 'Create and manage system users'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={fetchUsers}
                        disabled={loadingUsers}
                        className="flex items-center gap-1.5"
                    >
                        <RiRefreshLine size={15} className={loadingUsers ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                    <Button onClick={openModal} className="flex items-center gap-1.5">
                        <RiUserAddLine size={15} />
                        Create User
                    </Button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: 'Total Users', value: users.length, color: 'text-[var(--text-primary)]' },
                    { label: 'Active', value: users.filter(u => u.status === 'active').length, color: 'text-[#16A34A]' },
                    { label: 'Admins', value: users.filter(u => ['ADMIN', 'PLATFORM_ADMIN'].includes(u.role_id?.toUpperCase() ?? '')).length, color: 'text-[#92400E]' },
                ].map(stat => (
                    <Card key={stat.label}>
                        <CardContent className="pt-4 pb-4 text-center">
                            <p className={`text-[24px] font-bold ${stat.color}`}>{loadingUsers ? '—' : stat.value}</p>
                            <p className="text-[12px] text-[#6B7280] mt-0.5">{stat.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* User list */}
            {loadingUsers ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-28 rounded-xl bg-[var(--surface-3)] animate-pulse" />
                    ))}
                </div>
            ) : users.length === 0 ? (
                <EmptyState
                    kind="first-run"
                    title="No users found"
                    description="Create the first user to give someone access to this system."
                    action={
                        <Button onClick={openModal}>
                            <RiUserAddLine aria-hidden /> Create first user
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {users.map((u, idx) => {
                        const memberships = membershipMap.get(u.auth_id) ?? []
                        return (
                            <motion.div
                                key={u.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                            >
                                <Card className="hover:border-[#D1D5DB] transition-colors">
                                    <CardContent className="pt-4 pb-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--text-primary)] to-[#374151] text-white font-bold text-[15px]">
                                                {u.user_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{u.user_name}</p>
                                                <p className="text-[12px] text-[#6B7280] truncate">{u.email || u.auth_id}</p>
                                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${roleColor[u.role_id?.toUpperCase()] || roleColor.STAFF}`}>
                                                        {u.role_id?.toUpperCase()}
                                                    </span>
                                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusColor[u.status?.toLowerCase()] || statusColor.unset}`}>
                                                        {u.status}
                                                    </span>
                                                    {u.employee_id && (
                                                        <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[#6B7280]">
                                                            #{u.employee_id}
                                                        </span>
                                                    )}
                                                    {isPlatformAdmin && (
                                                        <span
                                                            title={memberships.map(m => `${m.name} (${m.role})`).join(', ') || 'Not enrolled in any laundry'}
                                                            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[#6B7280]"
                                                        >
                                                            <RiBuilding2Line size={11} />
                                                            {memberships.length === 0
                                                                ? 'No laundry'
                                                                : `${memberships.length} laundr${memberships.length === 1 ? 'y' : 'ies'}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-center gap-1">
                                                {isPlatformAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setManageUser(u)}
                                                        title="Manage laundries"
                                                        aria-label="Manage laundries"
                                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
                                                    >
                                                        <RiBuilding2Line size={15} />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(u)}
                                                    title="Edit user"
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
                                                >
                                                    <RiEditLine size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Create User Modal */}
            <AnimatePresence>
                {showModal && (
                    <>
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        />
                        <Portal><motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.96, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 12 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        >
                            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white shadow-2xl overflow-hidden">
                                {/* Modal header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--text-primary)] text-white">
                                            <RiEditLine size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[14px] font-bold text-[var(--text-primary)]">{editId ? 'Edit User' : 'Create User'}</p>
                                            <p className="text-[11px] text-[#6B7280]">{editId ? 'Update this system user' : 'Add a new system user'}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
                                    >
                                        <RiCloseLine size={16} />
                                    </button>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                                                Full Name <span className="text-[#DC2626]">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.user_name}
                                                onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))}
                                                className={inputClass}
                                                placeholder="John Silva"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                                                Username <span className="text-[#DC2626]">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.auth_id}
                                                onChange={e => setForm(f => ({ ...f, auth_id: e.target.value }))}
                                                className={inputClass}
                                                placeholder="john.silva"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                                            {editId ? 'New Password' : 'Password'} {!editId && <span className="text-[#DC2626]">*</span>}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPw ? 'text' : 'password'}
                                                value={form.password}
                                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                                className={`${inputClass} pr-10`}
                                                placeholder={editId ? 'Leave blank to keep current' : 'Secure password'}
                                                required={!editId}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPw(v => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPw ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Role</label>
                                            <select
                                                value={form.role_id}
                                                onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
                                                className={inputClass}
                                            >
                                                {roleOptions.map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Status</label>
                                            <select
                                                value={form.status}
                                                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                                className={inputClass}
                                            >
                                                {STATUSES.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {isPlatformAdmin && form.role_id !== 'PLATFORM_ADMIN' && (
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Enroll in laundry</label>
                                            <select
                                                value={form.laundry_id}
                                                onChange={e => setForm(f => ({ ...f, laundry_id: e.target.value }))}
                                                className={inputClass}
                                            >
                                                <option value="">— No enrollment —</option>
                                                {activeLaundries.map(l => (
                                                    <option key={l.laundry_id} value={l.laundry_id}>{l.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-[11px] text-[#98A2B3] mt-1">Optional. Enrolls this account as a member of the selected active laundry.</p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Email</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                            className={inputClass}
                                            placeholder="john@lovelaundry.lk"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Mobile</label>
                                            <input
                                                type="text"
                                                value={form.mobile_number}
                                                onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))}
                                                className={inputClass}
                                                placeholder="+94 77 123 4567"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Employee ID</label>
                                            <input
                                                type="text"
                                                value={form.employee_id}
                                                onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                                                className={inputClass}
                                                placeholder="EMP-001"
                                            />
                                        </div>
                                    </div>

                                    {/* Admin notice */}
                                    <div className="flex items-start gap-2 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-2.5">
                                        <RiShieldCheckLine size={14} className="text-[#16A34A] mt-0.5 shrink-0" />
                                        <p className="text-[11px] text-[#166534]">
                                            {editId
                                                ? 'Changes are saved immediately. Enter a new password only if you want to reset it.'
                                                : 'User will be created with the selected role. They can log in immediately using their username and password.'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 h-10 rounded-xl border border-[var(--border)] bg-white text-[13px] font-medium text-[#374151] hover:bg-[var(--surface-2)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 h-10 rounded-xl bg-[var(--text-primary)] text-[13px] font-medium text-white hover:bg-[#1D2939] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {submitting ? (
                                                <>
                                                    <RiRefreshLine size={14} className="animate-spin" />
                                                    {editId ? 'Saving…' : 'Creating…'}
                                                </>
                                            ) : (
                                                <>
                                                    <RiEditLine size={14} />
                                                    {editId ? 'Save Changes' : 'Create User'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div></Portal>
                    </>
                )}
            </AnimatePresence>

            {/* Manage laundries modal (platform admins) */}
            <ManageLaundriesModal
                user={manageUser}
                laundries={platformLaundries}
                memberships={manageUser ? membershipMap.get(manageUser.auth_id) ?? [] : []}
                loading={membersLoading}
                onClose={() => setManageUser(null)}
                onChanged={fetchUsers}
            />
        </div>
    )
}

function ManageLaundriesModal({
    user,
    laundries,
    memberships,
    loading,
    onClose,
    onChanged,
}: {
    user: UserRecord | null
    laundries: Laundry[]
    memberships: Membership[]
    loading: boolean
    onClose: () => void
    onChanged: () => void
}) {
    const qc = useQueryClient()
    useEscape(!!user, onClose)

    const refresh = (laundryId: string) => {
        void qc.invalidateQueries({ queryKey: ['platform-laundry-members', laundryId] })
        void qc.invalidateQueries({ queryKey: ['platform-laundries'] })
        void qc.invalidateQueries({ queryKey: ['users'] })
        onChanged()
    }

    const addMut = useMutation({
        mutationFn: ({ laundryId, role }: { laundryId: string; role: string }) =>
            laundryService.addMember(laundryId, { auth_id: user?.auth_id ?? '', role }),
        onSuccess: (_r, v) => {
            toast.success('Laundry membership added')
            refresh(v.laundryId)
        },
        onError: (e: any) => toast.error(e.response?.data?.detail || e.message || 'Add failed'),
    })

    const removeMut = useMutation({
        mutationFn: (laundryId: string) => laundryService.removeMember(laundryId, user?.auth_id ?? ''),
        onSuccess: (_r, laundryId) => {
            toast.success('Laundry membership removed')
            refresh(laundryId)
        },
        onError: (e: any) => toast.error(e.response?.data?.detail || e.message || 'Remove failed'),
    })

    const roleOf = new Map(memberships.map(m => [m.laundry_id, m.role]))
    const busy = addMut.isPending || removeMut.isPending

    // Portalled: the page tree sits under animated (transformed) wrappers, which
    // would otherwise capture the fixed overlay and centre it on the panel.
    return (
        <Portal>
            <AnimatePresence>
            {user && (
                <>
                    <motion.div
                        key="manage-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        key="manage-modal"
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--text-primary)] text-white">
                                        <RiBuilding2Line size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-bold text-[var(--text-primary)] truncate">Manage laundries</p>
                                        <p className="text-[11px] text-[#6B7280] truncate">{user.user_name} · {user.auth_id}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    <RiCloseLine size={16} />
                                </button>
                            </div>

                            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                                {loading ? (
                                    <p className="py-6 text-center text-[12px] text-[#98A2B3]">Loading laundries…</p>
                                ) : laundries.length === 0 ? (
                                    <p className="py-6 text-center text-[12px] text-[#98A2B3]">No laundries found.</p>
                                ) : (
                                    laundries.map(l => (
                                        <ManageLaundryRow
                                            key={l.laundry_id}
                                            laundry={l}
                                            currentRole={roleOf.get(l.laundry_id)}
                                            busy={busy}
                                            onAdd={(laundryId, role) => addMut.mutate({ laundryId, role })}
                                            onRemove={(laundryId) => removeMut.mutate(laundryId)}
                                        />
                                    ))
                                )}
                            </div>

                            <div className="flex justify-end px-4 py-3 border-t border-[var(--border)]">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="h-9 rounded-xl border border-[var(--border)] bg-white px-4 text-[13px] font-medium text-[#374151] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
            </AnimatePresence>
        </Portal>
    )
}

function ManageLaundryRow({
    laundry,
    currentRole,
    busy,
    onAdd,
    onRemove,
}: {
    laundry: Laundry
    currentRole?: string
    busy: boolean
    onAdd: (laundryId: string, role: string) => void
    onRemove: (laundryId: string) => void
}) {
    const isMember = currentRole != null
    const [role, setRole] = useState(currentRole ?? 'STAFF')

    return (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5">
            <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isMember ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]' : 'border-[var(--border)] bg-[var(--surface-2)] text-[#98A2B3]'}`}
                title={isMember ? 'Member' : 'Not a member'}
            >
                {isMember ? <RiCheckLine size={13} /> : <RiBuilding2Line size={13} />}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{laundry.name}</p>
                <p className="text-[11px] text-[#98A2B3] truncate">{laundry.laundry_id}</p>
            </div>
            <select
                value={isMember ? currentRole ?? 'STAFF' : role}
                onChange={e => setRole(e.target.value)}
                disabled={isMember || busy}
                title={isMember ? 'Role in this laundry' : 'Role to assign'}
                className="h-8 rounded-lg border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] disabled:opacity-60"
            >
                {TENANT_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                ))}
            </select>
            {isMember ? (
                <button
                    type="button"
                    onClick={() => onRemove(laundry.laundry_id)}
                    disabled={busy}
                    title="Remove from laundry"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#DC2626] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
                >
                    <RiUserUnfollowLine size={15} />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onAdd(laundry.laundry_id, role)}
                    disabled={busy}
                    title="Add to laundry"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#16A34A] hover:bg-[#F0FDF4] transition-colors disabled:opacity-50"
                >
                    <RiUserFollowLine size={15} />
                </button>
            )}
        </div>
    )
}
