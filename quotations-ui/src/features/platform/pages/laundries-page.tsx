import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Building2, Plus, Pencil, Users, LogIn, Ban, Archive, CheckCircle2,
  Search, X, UserPlus, UserMinus,
} from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import { FilterBar } from '../../../components/ui/filter-bar'
import { Badge } from '../../../components/ui/badge'
import { DataTable } from '../../../components/ui/data-table'
import { EmptyState } from '../../../components/ui/empty-state'
import { ExportButton } from '../../../components/ui/export-button'
import { Pagination } from '../../../components/ui/pagination'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useAuth } from '../../../context/AuthContext'
import { laundryService, type LaundryPayload } from '../services/laundry.service'
import type { Laundry } from '../../../types/auth'
import { Portal } from '../../../components/ui/portal'

const PAGE_SIZE = 20
const STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const
const ICONS = ['🏭', '🧺', '🌊', '✨', '👕', '🏨', '🧼', '♻️']

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  ARCHIVED: 'neutral',
}

function useLaundryTotal(status: string) {
  return useQuery({
    queryKey: ['platform-laundries-total', status],
    queryFn: () => laundryService.list({ status, limit: 1, offset: 0 }).then((r) => r.total),
  })
}

/**
 * Platform Laundries — the registry of independent businesses.
 *
 * Platform administrators only. Each row is one isolated operational
 * environment; suspending blocks its sessions server-side, archiving keeps
 * history without operations. No financial or employee data surfaces here —
 * only identity, status, and membership counts.
 */
export default function LaundriesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { enterSupport } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Laundry | null>(null)
  const [detail, setDetail] = useState<Laundry | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ laundry: Laundry; to: string } | null>(null)
  const [icon, setIcon] = useState(ICONS[0])

  useEffect(() => {
    setOffset(0)
  }, [search, status])

  const { data: page = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['platform-laundries', search, status, offset],
    queryFn: () =>
      laundryService.list({
        search: search || undefined,
        status: status || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  })

  const { data: totalAll = 0 } = useLaundryTotal('')
  const { data: totalActive = 0 } = useLaundryTotal('ACTIVE')
  const { data: totalSuspended = 0 } = useLaundryTotal('SUSPENDED')
  const { data: totalArchived = 0 } = useLaundryTotal('ARCHIVED')

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['platform-laundries'] })
    void qc.invalidateQueries({ queryKey: ['platform-laundries-total'] })
  }

  const saveMut = useMutation({
    mutationFn: (data: LaundryPayload) =>
      editing ? laundryService.update(editing.laundry_id, data) : laundryService.create(data),
    onSuccess: () => {
      toast.success(editing ? 'Laundry updated' : 'Laundry registered')
      invalidate()
      setShowForm(false)
      setEditing(null)
      setDetail(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || e.message || 'Save failed'),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => laundryService.setStatus(id, to),
    onSuccess: (_r, { to }) => {
      toast.success(to === 'ACTIVE' ? 'Laundry activated' : `Laundry ${to.toLowerCase()}`)
      invalidate()
      setStatusTarget(null)
      setDetail(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || e.message || 'Status change failed'),
  })

  const enterMut = useMutation({
    mutationFn: (laundry: Laundry) => laundryService.enter(laundry.laundry_id),
    onSuccess: (res, laundry) => {
      enterSupport({
        token: res.access_token,
        user: res.user,
        laundryId: laundry.laundry_id,
        laundryName: laundry.name,
      })
      toast.success(`Support session in ${laundry.name} — audited, 1 hour`)
      navigate('/', { replace: true })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || e.message || 'Entry failed'),
  })

  const openCreate = () => {
    setEditing(null)
    setIcon(ICONS[0])
    setShowForm(true)
  }

  const openEdit = (laundry: Laundry) => {
    setEditing(laundry)
    setIcon(laundry.icon || ICONS[0])
    setShowForm(true)
  }

  const columns = [
    {
      key: 'name',
      header: 'Laundry',
      render: (l: Laundry) => (
        <span className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-[var(--surface-2)] text-[16px]" aria-hidden>
            {l.icon || l.logo_url ? (l.icon ?? '🏭') : '🏭'}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{l.name}</span>
            <span className="block truncate text-[11.5px] text-[var(--text-faint)]">{l.laundry_id}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'br_number',
      header: 'BR number',
      render: (l: Laundry) => <span className="text-[var(--text-secondary)]">{l.br_number || '—'}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      render: (l: Laundry) => <span className="text-[var(--text-secondary)]">{l.location || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center' as const,
      render: (l: Laundry) => <Badge variant={STATUS_TONE[l.status] ?? 'neutral'}>{l.status}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Registered',
      render: (l: Laundry) => <span className="whitespace-nowrap">{String(l.created_at ?? '').slice(0, 10) || '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center' as const,
      render: (l: Laundry) => (
        <span className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setDetail(l)} className="rounded p-1.5 hover:bg-[var(--surface-hover)]" title="Open" aria-label={`Open ${l.name}`}>
            <Building2 size={15} />
          </button>
          <button onClick={() => openEdit(l)} className="rounded p-1.5 hover:bg-[var(--surface-hover)]" title="Edit" aria-label={`Edit ${l.name}`}>
            <Pencil size={14} />
          </button>
          <button
            onClick={() => enterMut.mutate(l)}
            disabled={enterMut.isPending}
            className="rounded p-1.5 text-[var(--brand-text)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            title="Enter with audited support session"
            aria-label={`Enter ${l.name} with support session`}
          >
            <LogIn size={14} />
          </button>
        </span>
      ),
    },
  ]

  const exportCols = [
    { key: 'laundry_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'br_number', label: 'BR' },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Registered' },
  ]

  return (
    <div className="route-enter space-y-4">
      <PageHeader
        title="Laundries"
        subtitle={`${totalAll} registered · ${totalActive} active — each an isolated business environment`}
        actions={
          <>
            <ExportButton data={page.items} filename="laundries" columns={exportCols} />
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus size={16} /> Register laundry
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger">
        <StatCard label="Registered" value={totalAll} icon={<Building2 size={20} />} color="blue" />
        <StatCard label="Active" value={totalActive} icon={<CheckCircle2 size={20} />} color="green" />
        <StatCard label="Suspended" value={totalSuspended} icon={<Ban size={20} />} color="amber" />
        <StatCard label="Archived" value={totalArchived} icon={<Archive size={20} />} color="gray" />
      </div>

      <FilterBar>
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name..."
            aria-label="Search laundries"
            className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] py-2 pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)]"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </FilterBar>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={page.items}
            emptyState={
              <EmptyState
                icon={<Building2 size={28} />}
                title="No laundries found"
                description={search || status ? 'No laundry matches your filters.' : 'Register the first laundry to begin.'}
              />
            }
          />
          <Pagination total={page.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} className="px-1" />
        </>
      )}

      {showForm && (
        <LaundryForm
          initial={editing}
          icon={icon}
          setIcon={setIcon}
          saving={saveMut.isPending}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSubmit={(data) => saveMut.mutate(data)}
        />
      )}

      {detail && (
        <LaundryDetail
          laundry={detail}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
          onStatus={(to) => setStatusTarget({ laundry: detail, to })}
          onEnter={() => enterMut.mutate(detail)}
          entering={enterMut.isPending}
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={`${statusTarget?.to === 'ACTIVE' ? 'Activate' : statusTarget?.to === 'SUSPENDED' ? 'Suspend' : 'Archive'} ${statusTarget?.laundry.name}?`}
        message={
          statusTarget?.to === 'SUSPENDED'
            ? 'Suspended laundries cannot operate — existing sessions are refused server-side. History is preserved.'
            : statusTarget?.to === 'ARCHIVED'
              ? 'Archived laundries keep all history but stop operating. This is reversible by activation.'
              : 'The laundry resumes normal operations.'
        }
        confirmLabel={statusTarget?.to === 'ACTIVE' ? 'Activate' : statusTarget?.to ?? 'Confirm'}
        loading={statusMut.isPending}
        onConfirm={() => statusTarget && statusMut.mutate({ id: statusTarget.laundry.laundry_id, to: statusTarget.to })}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite" aria-label="Loading laundries">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-shimmer h-14 rounded bg-[var(--skeleton-from)]" aria-hidden />
      ))}
    </div>
  )
}

function LaundryForm({
  initial,
  icon,
  setIcon,
  saving,
  onClose,
  onSubmit,
}: {
  initial: Laundry | null
  icon: string
  setIcon: (v: string) => void
  saving: boolean
  onClose: () => void
  onSubmit: (data: LaundryPayload) => void
}) {
  return (
    <Portal><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="menu-pop max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--surface)] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? 'Edit laundry' : 'Register laundry'}</h2>
          <button onClick={onClose} aria-label="Close form"><X size={20} /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const str = (k: string) => String(fd.get(k) ?? '').trim() || undefined
            onSubmit({
              laundry_id: String(fd.get('laundry_id') ?? '').trim().toLowerCase(),
              name: String(fd.get('name') ?? '').trim(),
              br_number: str('br_number'),
              location: str('location'),
              address: str('address'),
              contact_number: str('contact_number'),
              email: str('email'),
              logo_url: str('logo_url'),
              icon,
              description: str('description'),
              subscription_plan: str('subscription_plan'),
            })
          }}
          className="space-y-3"
        >
          {!initial && (
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="laundry_id">
                Laundry ID (permanent, lowercase, 3–64 chars) *
              </label>
              <input id="laundry_id" name="laundry_id" required minLength={3} maxLength={64} pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" placeholder="e.g. clean-care" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="laundry_name">Business name *</label>
            <input id="laundry_name" name="name" required defaultValue={initial?.name} placeholder="e.g. CleanCare Laundry" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="br_number">BR number</label>
              <input id="br_number" name="br_number" defaultValue={initial?.br_number ?? ''} className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="location">Location</label>
              <input id="location" name="location" defaultValue={initial?.location ?? ''} className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="address">Address</label>
            <input id="address" name="address" defaultValue={initial?.address ?? ''} className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="contact_number">Contact number</label>
              <input id="contact_number" name="contact_number" defaultValue={initial?.contact_number ?? ''} className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="email">Business email</label>
              <input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs text-[var(--text-muted)]">Icon</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Laundry icon">
              {ICONS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  role="radio"
                  aria-checked={icon === candidate}
                  onClick={() => setIcon(candidate)}
                  className={`flex size-9 items-center justify-center rounded-sm border text-[18px] transition-colors ${icon === candidate ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border-2)] hover:bg-[var(--surface-hover)]'}`}
                >
                  {candidate}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="logo_url">Logo URL (optional)</label>
            <input id="logo_url" name="logo_url" type="url" defaultValue={initial?.logo_url ?? ''} placeholder="https://…" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={2} defaultValue={initial?.description ?? ''} className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="subscription_plan">Subscription plan (optional)</label>
            <input id="subscription_plan" name="subscription_plan" defaultValue={initial?.subscription_plan ?? ''} placeholder="e.g. growth" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div></Portal>
  )
}

function LaundryDetail({
  laundry,
  onClose,
  onEdit,
  onStatus,
  onEnter,
  entering,
}: {
  laundry: Laundry
  onClose: () => void
  onEdit: () => void
  onStatus: (to: string) => void
  onEnter: () => void
  entering: boolean
}) {
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['platform-laundry-members', laundry.laundry_id],
    queryFn: () => laundryService.members(laundry.laundry_id),
  })
  const qc = useQueryClient()
  const [newMemberId, setNewMemberId] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('STAFF')
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  const refreshMembers = () => {
    void qc.invalidateQueries({ queryKey: ['platform-laundry-members', laundry.laundry_id] })
  }

  const addMut = useMutation({
    mutationFn: () => laundryService.addMember(laundry.laundry_id, { auth_id: newMemberId.trim(), role: newMemberRole }),
    onSuccess: () => {
      toast.success('Member added')
      setNewMemberId('')
      refreshMembers()
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || e.message || 'Add failed'),
  })

  const removeMut = useMutation({
    mutationFn: (authId: string) => laundryService.removeMember(laundry.laundry_id, authId),
    onSuccess: () => {
      toast.success('Member removed')
      setRemoveTarget(null)
      refreshMembers()
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || e.message || 'Remove failed'),
  })

  return (
    <Portal><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="menu-pop max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--surface)] p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded bg-[var(--surface-2)] text-[24px]" aria-hidden>
              {laundry.icon ?? '🏭'}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{laundry.name}</h2>
              <p className="text-xs text-[var(--text-muted)]">{laundry.laundry_id} · registered {String(laundry.created_at ?? '').slice(0, 10) || '—'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close details"><X size={20} /></button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_TONE[laundry.status] ?? 'neutral'}>{laundry.status}</Badge>
          <span className="flex-1" />
          <button onClick={onEdit} className="flex items-center gap-1 rounded-lg border border-[var(--border-2)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover)]">
            <Pencil size={13} /> Edit
          </button>
          {laundry.status !== 'ACTIVE' && (
            <button onClick={() => onStatus('ACTIVE')} className="flex items-center gap-1 rounded-lg border border-[var(--border-2)] px-3 py-1.5 text-xs font-medium text-[var(--success-text)] hover:bg-[var(--surface-hover)]">
              <CheckCircle2 size={13} /> Activate
            </button>
          )}
          {laundry.status === 'ACTIVE' && (
            <button onClick={() => onStatus('SUSPENDED')} className="flex items-center gap-1 rounded-lg border border-[var(--border-2)] px-3 py-1.5 text-xs font-medium text-[var(--warning-text)] hover:bg-[var(--surface-hover)]">
              <Ban size={13} /> Suspend
            </button>
          )}
          {laundry.status !== 'ARCHIVED' && (
            <button onClick={() => onStatus('ARCHIVED')} className="flex items-center gap-1 rounded-lg border border-[var(--border-2)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover)]">
              <Archive size={13} /> Archive
            </button>
          )}
          <button
            onClick={onEnter}
            disabled={entering}
            className="flex items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <LogIn size={13} /> {entering ? 'Entering…' : 'Enter'}
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            ['BR number', laundry.br_number],
            ['Location', laundry.location],
            ['Address', laundry.address],
            ['Contact', laundry.contact_number],
            ['Email', laundry.email],
            ['Plan', laundry.subscription_plan],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] text-[var(--text-muted)]">{label}</dt>
              <dd className="truncate font-medium">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        {laundry.description && <p className="mt-3 text-sm text-[var(--text-secondary)]">{laundry.description}</p>}

        <h3 className="mt-5 mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Users size={15} /> Members ({members.length})
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newMemberId.trim()) addMut.mutate()
          }}
          className="mb-2 flex flex-wrap gap-2"
        >
          <input
            value={newMemberId}
            onChange={(e) => setNewMemberId(e.target.value)}
            placeholder="User login name"
            aria-label="User login name"
            className="min-w-[160px] flex-1 rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          />
          <select
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value)}
            aria-label="Member role"
            className="rounded-lg border border-[var(--border-2)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          >
            {['ADMIN', 'MANAGER', 'STAFF'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newMemberId.trim() || addMut.isPending}
            className="flex items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <UserPlus size={13} /> {addMut.isPending ? 'Adding…' : 'Add'}
          </button>
        </form>
        {membersLoading ? (
          <p className="py-3 text-center text-xs text-[var(--text-muted)]">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="py-3 text-center text-xs text-[var(--text-muted)]">No members yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">User</th>
                  <th className="px-3 py-2 text-left font-medium">Role</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-center font-medium">Remove</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={`${m.auth_id}-${m.laundry_id}`} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{m.auth_id}</td>
                    <td className="px-3 py-2">{m.role}</td>
                    <td className="px-3 py-2">{m.status}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => setRemoveTarget(m.auth_id)}
                        className="rounded p-1 text-[var(--danger-text)] hover:bg-[var(--surface-hover)]"
                        title={`Remove ${m.auth_id}`}
                        aria-label={`Remove ${m.auth_id}`}
                      >
                        <UserMinus size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member?"
        message={`${removeTarget} loses access to ${laundry.name}. The last administrator cannot be removed.`}
        confirmLabel="Remove"
        loading={removeMut.isPending}
        onConfirm={() => removeTarget && removeMut.mutate(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
      />
    </div></Portal>
  )
}
