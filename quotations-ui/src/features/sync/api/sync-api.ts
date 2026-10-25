import billsApi from '../../../api/bills-api'

export interface SyncHotelStatus {
  client_name: string
  hotel_code: string
  sections: SyncSection[]
  overall_status: 'synced' | 'partial' | 'pending' | 'error'
  last_synced_at: string | null
}

export interface SyncSection {
  kind: 'receiving' | 'delivery' | 'rewash'
  label: string
  total_days: number
  synced_days: number
  pending_days: number
  error_days: number
  gate_pass_count: number
  bill_count: number
  return_count: number
  status: 'synced' | 'partial' | 'pending' | 'error'
  details: SyncDayDetail[]
}

export interface SyncDayDetail {
  day: number
  date: string
  status: 'synced' | 'pending' | 'error' | 'empty'
  gate_pass_ids: string[]
  bill_ids: string[]
  return_ids: string[]
  quantities_total: number
}

export interface SyncResult {
  hotel: string
  kind: string
  synced_count: number
  created_count: number
  updated_count: number
  errors: string[]
}

/**
 * Fetch sync status overview for all hotels in the given month range.
 */
export async function fetchSyncStatus(year: number, month: number): Promise<SyncHotelStatus[]> {
  const { data } = await billsApi.get<SyncHotelStatus[]>(
    `/monthly/sync-status/${year}/${month}`,
  )
  return data
}

/**
 * Trigger a full sync for a specific hotel and month.
 */
export async function triggerHotelSync(
  clientName: string,
  year: number,
  month: number,
  kinds?: string[],
): Promise<SyncResult[]> {
  const { data } = await billsApi.post<SyncResult[]>('/monthly/trigger-sync', {
    client_name: clientName,
    year,
    month,
    kinds: kinds ?? ['receiving', 'delivery', 'rewash'],
  })
  return data
}

/**
 * Trigger a global sync for all hotels in a given month.
 */
export async function triggerGlobalSync(
  year: number,
  month: number,
): Promise<SyncResult[]> {
  const { data } = await billsApi.post<SyncResult[]>('/monthly/trigger-sync-all', {
    year,
    month,
  })
  return data
}
