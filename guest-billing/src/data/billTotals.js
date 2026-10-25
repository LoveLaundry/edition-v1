export function calculateBillTotals(items) {
    return items.reduce((totals, item) => {
        const lineAmount = item.quantity * item.price;
        const lineAmountCents = Math.round((lineAmount + Number.EPSILON * Math.abs(lineAmount)) * 100);

        return {
            quantity: totals.quantity + item.quantity,
            amountCents: totals.amountCents + lineAmountCents,
        };
    }, { quantity: 0, amountCents: 0 });
}
