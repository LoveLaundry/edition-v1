import billsApi from '../../../api/bills-api'
import { idempotencyKey } from '../../../lib/idempotency'
import type {
    MonthlyConfirmPayload,
    MonthlyKind,
    MonthlyMatrixResponse,
    MonthlyMonthDoc,
    MonthlyQuantitiesPayload,
} from '../../../types/monthly'

/**
 * Hotel names reach the server as a path segment, so a name containing a slash
 * or an ampersand must not be allowed to split the route.
 */
function seg(value: string): string {
    return encodeURIComponent(value)
}

function monthPath(kind: MonthlyKind, clientName: string, year: number, month: number): string {
    return `/monthly/${seg(kind)}/${seg(clientName)}/${year}/${month}`
}

export const monthly = {
    /**
     * The whole month as rows x days, with `cells` as the item-key pivot.
     *
     * `quotation_id` is optional: when omitted the server falls back to the
     * month document's own quotation, so switching kinds or months keeps
     * whatever pricing was last confirmed.
     */
    matrix: (
        kind: MonthlyKind,
        clientName: string,
        year: number,
        month: number,
        quotationId?: string | null,
    ): Promise<MonthlyMatrixResponse> =>
        billsApi
            .get<MonthlyMatrixResponse>(monthPath(kind, clientName, year, month), {
                params: quotationId ? { quotation_id: quotationId } : {},
            })
            .then((r) => r.data),

    /**
     * Persist a day's edited cells. Quantities of 0 (or omitted) clear the
     * cell, and clearing every cell removes the day entirely - which is why an
     * "empty" day needs no separate delete call.
     */
    saveDayQuantities: (
        kind: MonthlyKind,
        clientName: string,
        year: number,
        month: number,
        day: number,
        payload: MonthlyQuantitiesPayload,
    ): Promise<MonthlyMonthDoc> =>
        billsApi
            .put<MonthlyMonthDoc>(
                `${monthPath(kind, clientName, year, month)}/day/${day}/quantities`,
                payload,
            )
            .then((r) => r.data),

    /**
     * Turn a day into real records. Receiving creates a DRAFT gate pass, a
     * delivery day creates DRAFT deliveries off the chosen source gate passes,
     * and a rewash day is recorded directly. Every write is idempotency-keyed
     * so a retried confirm cannot create a second day's records.
     */
    confirmDay: async (
        kind: MonthlyKind,
        clientName: string,
        year: number,
        month: number,
        day: number,
        payload: MonthlyConfirmPayload,
    ): Promise<MonthlyMonthDoc> => {
        const key = await idempotencyKey({ kind, clientName, year, month, day, payload })
        return billsApi
            .post<MonthlyMonthDoc>(
                `${monthPath(kind, clientName, year, month)}/day/${day}/confirm`,
                payload,
                { headers: { 'X-Idempotency-Key': key } },
            )
            .then((r) => r.data)
    },

    /**
     * Clear a day that was entered but not confirmed. Confirmed days are
     * rejected by the server: their records are reversed through their own
     * gate-pass / delivery / rewash flows instead.
     */
    cancelDay: (
        kind: MonthlyKind,
        clientName: string,
        year: number,
        month: number,
        day: number,
    ): Promise<MonthlyMonthDoc> =>
        billsApi
            .patch<MonthlyMonthDoc>(`${monthPath(kind, clientName, year, month)}/day/${day}/cancel`)
            .then((r) => r.data),
}
