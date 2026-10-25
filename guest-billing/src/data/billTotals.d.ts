export interface BillLineItem {
    itemName: string;
    quantity: number;
    price: number;
}

export interface BillTotals {
    quantity: number;
    amountCents: number;
}

export function calculateBillTotals(items: readonly BillLineItem[]): BillTotals;
