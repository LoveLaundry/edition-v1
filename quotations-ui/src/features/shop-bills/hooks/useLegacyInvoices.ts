import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shopBillService } from '../services/shop-bill.service'
import type { LegacyInvoiceCreate } from '../../../types/shop-bill'

export const legacyInvoiceKeys = {
  all: ['legacy-invoices'] as const,
  list: (params?: { skip?: number; limit?: number; search?: string; sortBy?: string; sortDir?: 'asc' | 'desc' }) =>
    [...legacyInvoiceKeys.all, 'list', params] as const,
  detail: (id: string) => [...legacyInvoiceKeys.all, id] as const,
}

export function useLegacyInvoices(params?: { skip?: number; limit?: number; search?: string; sortBy?: string; sortDir?: 'asc' | 'desc' }) {
  return useQuery({
    queryKey: legacyInvoiceKeys.list(params),
    queryFn: () => shopBillService.listLegacyInvoices(params),
  })
}

export function useLegacyInvoice(id?: string) {
  return useQuery({
    queryKey: legacyInvoiceKeys.detail(id ?? ''),
    queryFn: () => shopBillService.getLegacyInvoice(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useCreateLegacyInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LegacyInvoiceCreate) => shopBillService.createLegacyInvoice(payload),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: legacyInvoiceKeys.all })
      toast.success(`Invoice ${invoice.invoice_number} saved`)
    },
    onError: () => toast.error('Failed to save invoice'),
  })
}

export function useUpdateLegacyInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LegacyInvoiceCreate }) =>
      shopBillService.updateLegacyInvoice(id, payload),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: legacyInvoiceKeys.all })
      toast.success(`Invoice ${invoice.invoice_number} updated`)
    },
    onError: () => toast.error('Failed to update invoice'),
  })
}

export function useMarkLegacyPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => shopBillService.markLegacyPaid(id),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: legacyInvoiceKeys.all })
      toast.success(`Invoice ${invoice.invoice_number} marked as paid`)
    },
    onError: () => toast.error('Failed to mark invoice as paid'),
  })
}

export function useDeleteLegacyInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => shopBillService.deleteLegacyInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: legacyInvoiceKeys.all })
      toast.success('Invoice deleted')
    },
    onError: () => toast.error('Failed to delete invoice'),
  })
}