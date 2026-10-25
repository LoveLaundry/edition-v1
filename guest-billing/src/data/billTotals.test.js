import assert from "node:assert/strict";
import test from "node:test";
import { calculateBillTotals } from "./billTotals.js";

test("calculates quantity and amount totals from bill line items", () => {
    const totals = calculateBillTotals([
        { itemName: "Shirt", quantity: 3, price: 15 },
        { itemName: "Pants", quantity: 2, price: 25 },
        { itemName: "Jacket", quantity: 1, price: 50 },
    ]);

    assert.deepEqual(totals, { quantity: 6, amountCents: 14500 });
});

test("sums currency totals as integer cents", () => {
    const totals = calculateBillTotals([
        { itemName: "Item A", quantity: 3, price: 10.25 },
        { itemName: "Item B", quantity: 2, price: 0.1 },
    ]);

    assert.deepEqual(totals, { quantity: 5, amountCents: 3095 });
});

test("rounds half-cent line amounts consistently", () => {
    const totals = calculateBillTotals([
        { itemName: "Item A", quantity: 1, price: 1.005 },
        { itemName: "Item B", quantity: 1, price: 1.005 },
    ]);

    assert.deepEqual(totals, { quantity: 2, amountCents: 202 });
});

test("returns zero totals for an empty bill", () => {
    assert.deepEqual(calculateBillTotals([]), { quantity: 0, amountCents: 0 });
});
