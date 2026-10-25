import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateResource } from '../../../cache/invalidation'
import { gatepasses } from '../services/gatepass.service'
import { deliveries } from '../services/delivery.service'
import { monthly } from '../services/monthly.service'
import type {
    MonthlyConfirmPayload,
    MonthlyKind,
    MonthlyQuantitiesPayload,
} from '../../../types/monthly'

export interface MonthlyMatrixParams {
    kind: MonthlyKind
    clientName: string
    year: number
    month: number
    quotationId?: string | null
}

export const monthlyKeys = {
    all: ['monthly'] as const,
    matrix: (p: MonthlyMatrixParams) =>
        [...monthlyKeys.all, 'matrix', p.kind, p.clientName, p.year, p.month, p.quotationId ?? ''] as const,
}

function pathArgs(p: MonthlyMatrixParams) {
    return [p.kind, p.clientName, p.year, p.month] as const
}

/**
 * The month grid for one hotel and one kind.
 *
 * Kept out of the cache until a hotel is actually chosen: the matrix is
 * per-client, so an "all hotels" selection has no single document to fetch.
 */
export function useMonthlyMatrix(params: MonthlyMatrixParams) {
    const enabled = Boolean(params.clientName) && Boolean(params.year) && Boolean(params.month)
    return useQuery({
        queryKey: monthlyKeys.matrix(params),
        queryFn: () => monthly.matrix(...pathArgs(params), params.quotationId),
        enabled,
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
    })
}

/**
 * A confirmed day creates real gate passes / deliveries, and an activated one
 * changes their statuses, so both the grid and every operations list that shows
 * those records are stale afterwards.
 */
function invalidateMonthlyAndOperations(qc: ReturnType<typeof useQueryClient>) {
    invalidateResource(qc, 'monthly')
    invalidateResource(qc, 'gatepasses')
}

export function useSaveDayQuantities(params: MonthlyMatrixParams) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: { day: number; payload: MonthlyQuantitiesPayload }) =>
            monthly.saveDayQuantities(
                ...pathArgs(params),
                input.day,
                input.payload,
            ),
        onSuccess: () => {
            invalidateMonthlyAndOperations(qc)
            toast.success('Day saved')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to save the day'),
    })
}

export function useConfirmMonthlyDay(params: MonthlyMatrixParams) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: { day: number; payload: MonthlyConfirmPayload }) =>
            monthly.confirmDay(...pathArgs(params), input.day, input.payload),
        onSuccess: () => {
            invalidateMonthlyAndOperations(qc)
            toast.success('Day confirmed and records created')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to confirm the day'),
    })
}

export function useCancelMonthlyDay(params: MonthlyMatrixParams) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (day: number) => monthly.cancelDay(...pathArgs(params), day),
        onSuccess: () => {
            invalidateMonthlyAndOperations(qc)
            toast.success('Day cleared')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to clear the day'),
    })
}

/**
 * DRAFT gate pass -> RECEIVED. This is what makes a month's receiving count as
 * real stock; until it is pressed the pass stays out of every balance.
 */
export function useActivateGatePass() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => gatepasses.updateStatus(id, 'RECEIVED'),
        onSuccess: () => {
            invalidateMonthlyAndOperations(qc)
            toast.success('Gate pass activated')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to activate the gate pass'),
    })
}

/** DRAFT delivery -> DELIVERED, re-validated against the live gate pass balance. */
export function useActivateDelivery() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => deliveries.activate(id),
        onSuccess: () => {
            invalidateMonthlyAndOperations(qc)
            toast.success('Delivery activated')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to activate the delivery'),
    })
}
