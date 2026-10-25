# LoveLaundry — App Split Structure (Proposal v1)

Status: **awaiting approval**. No code has been written for the new apps yet.
Scope: split the single `quotations-ui` monolith into purpose-built apps for
**laundry**, **shop**, **hotel**, and **linen room**, without changing any
existing data or API contract.

---

## 1. What exists today (verified, not assumed)

| Service | Responsibility | Key routers |
|---|---|---|
| `user-service` | Auth, users, laundries (tenants), memberships, roles | `main.py`, `routers/laundries.py` |
| `bill_service` | Operational core | `gatepasses`, `deliveries`, `bills`, `linens`, `shop_bills`, `returns`, `monthly`, `dispatch`, `dashboard` |
| `laundry-management` | Accounting | `customers`, `transactions`, `payments`, `expenses`, `salary`, `employees`, `items` |
| `quotation-service` | Quotations + AI chat | `main.py`, `routers/chat.py` |
| `worker-service` | Workers | `main.py` |
| `love-ai` | AI service | `api/` |

Front ends today:

- `quotations-ui` — one Vite 8 / React 19 / TS 6 / Tailwind 4 app holding **every** feature:
  `ai`, `auth`, `gatepass`, `linen`, `management`, `platform`, `quotations`,
  `reports-backup`, `shop-bills`, `sync`, `today`, `workers`.
- `guest-billing` — standalone bill/PDF printing tool.
- `public.lovelaundry.lk` — marketing site.
- `LoveMobi` — Flutter app.

### The two constraints that shape everything

**C1 — Tenant isolation is `laundry_id` from the signed JWT, nothing else.**
`bill_service/src/bill_service/tenancy.py` states the contract: the tenant comes
only from JWT claims, every query is scoped `{"laundry_id": tid}`, there is no
unscoped fallback, and cross-tenant linkage fails closed. Any new app must keep
this rule byte-for-byte.

**C2 — A "hotel" is not an entity. It is a `client_name` string.**
`context/HotelContext.tsx` documents it explicitly: gate passes, deliveries,
bills and quotations carry `client_name`, and the hotel list is derived by
collecting distinct values. There is no hotels collection, no hotel id, no
hotel→user link.

> **Consequence:** a hotel *client* logging in today has no identity to log in
> with. Only staff of a laundry tenant have accounts. This is the single most
> important decision in this document (Decision 1).

---

## 2. Proposed app matrix

| # | App | Users | Primary job | Data it touches |
|---|---|---|---|---|
| 1 | **Laundry Ops** *(existing `quotations-ui`)* | Laundry owner / admin / manager / counter staff | Full operations: gate passes, deliveries, bills, quotations, workers, reports | all of `bill_service`, `quotation-service`, `worker-service` |
| 2 | **Shop Counter** *(new)* | Shop manager / counter staff | Shop bills, quick bill, payments, day close, shop client balances | `shop_bills`, `day_close`, `day_money`, `customers` |
| 3 | **Hotel Desk** *(new)* | Hotel account manager / admin (hotel-side internal managers) | Hotel accounts: gate passes, deliveries, monthly quantities, invoices, statements | `gatepasses`, `deliveries`, `bills`, `monthly`, scoped to `client_name` |
| 4 | **Linen Room** *(new)* | Linen room supervisor / housekeeper | Scan linen in/out, status transitions, inventory counts, discrepancies | `linens`, `bulk-scan`, `generate-tags`, `stats/summary` |

The **two hotel logins** the request describes map to apps 3 and 4:

- **Hotel Desk** — managers/admins. Full financial and operational view for
  their hotel account(s).
- **Linen Room** — supervisors/housekeepers. Scan-only, mobile-first, no prices,
  no customer balances, no monthly money screens.

This is a *role* distinction inside one identity store, not two separate user
databases.

---

## 3. Roles

Roles today are free-form strings in `role_id` (`ADMIN`, `PLATFORM_ADMIN`, and
mixed-case values such as `Manager`, `staff`, `Housekeeping` are already in use).
`require_role()` uppercases before comparing and treats `PLATFORM_ADMIN` as a
superset of `ADMIN`.

Proposed **additive** role set (no renaming, no data rewrite):

| Role | App | Can |
|---|---|---|
| `SHOP_MANAGER` | Shop Counter | everything in shop app, incl. day close, void, price edit |
| `SHOP_STAFF` | Shop Counter | create bills, take payment, no void/close |
| `HOTEL_MANAGER` | Hotel Desk | hotel account ops, invoices, statements |
| `HOTEL_ADMIN` | Hotel Desk | + rates, month lock/unlock |
| `LINEN_SUPERVISOR` | Linen Room | all scans, correct discrepancies, generate tags |
| `HOUSEKEEPER` | Linen Room | collect / receive / mark dirty-clean only |

Existing roles keep working untouched. A role added later is a data seed, not a
migration.

---

## 4. Data invariants (non-negotiable)

1. **One source of truth.** The new apps are clients of the existing services.
   No new collections, no duplicated tables, no shadow writes in phase 1.
2. **Tenant from JWT only.** Never from URL, body, query, or storage.
3. **No schema change in phase 1.** Hotels stay `client_name`; a hotel directory
   is derived read-only, exactly like `HotelContext` does today.
4. **Money is computed once.** Totals, balances and day-close numbers come from
   `bill_service` (`balance_engine`, `day_close`). No app re-implements an
   arithmetic rule.
5. **Separate storage per app.** Each app namespaces its keys
   (`ll_shop_token`, `ll_hotel_token`, `ll_linen_token`) so two apps can never
   read each other's session even if later served on one host.
6. **Additive only.** Nothing existing is deleted, renamed, or re-typed.

---

## 5. Repository structure — two viable options

### Option A — one monorepo, three deploys *(recommended)*

```
lovelaundry-apps/            (new repo)
├─ apps/
│  ├─ shop/                  → shop.lovelaundry.lk
│  ├─ hotel/                 → hotel.lovelaundry.lk
│  └─ linen-room/            → linen.lovelaundry.lk
├─ packages/
│  ├─ core/                  API client, auth context, tenant guard, error handling
│  ├─ ui/                    buttons, tables, dialogs, Portal (from the overlay fix)
│  └─ tokens/                Tailwind theme, fonts, colours
└─ package.json              npm workspaces
```

One `npm install`, one lockfile, one CI, three Vercel projects each pointing at
its own root directory. Shared logic is genuinely shared — a fix in `core`
reaches all three apps, so they cannot drift apart.

### Option B — three standalone repos

`shop-app`, `hotel-app`, `linen-room-app`, each with its own copy of the API
client and auth. Simpler to reason about, but three copies of the same code will
diverge within weeks, and that is exactly the "conflicting data" risk to avoid.

**Recommendation: Option A.** It matches the "must be perfect, never conflict"
requirement better than duplication does.

---

## 6. Phased build (each phase ships working software)

| Phase | Deliverable | Verification |
|---|---|---|
| P0 | This document approved | — |
| P1 | Repo scaffold, `packages/core` + `ui` + `tokens`, auth shell, tenant guard, one smoke screen per app | `npm run build` green in all three; login → token → scoped request proven |
| P2 | **Shop Counter**: bill list, quick bill, bill detail, record payment, day close | numbers reconcile against existing shop-bills screen, same bill id = same total |
| P3 | **Hotel Desk**: hotel picker, gate pass, delivery, monthly matrix, invoice/statement | totals match `bill_service` responses exactly; no client-side recomputation |
| P4 | **Linen Room**: scan station, bulk scan, status transitions, inventory, discrepancies | scan action set = `collect, receive, start_wash, complete_wash, press, ready, deliver, mark_missing, mark_damaged, retire` |
| P5 | Role seeds, route gating, deploy config, redirect map from old URLs | role matrix tested per app; old routes never 404 silently |

`quotations-ui` stays fully working and unchanged throughout. Nothing is removed
until its replacement is proven in production.

---

## 7. Decisions I need from you

1. **Hotel identity** — are hotel-side users your own staff (roles on a laundry
   tenant), or real hotel clients who need accounts of their own? The second
   needs a new `client_accounts` entity, client-scoped JWTs and a new scoping
   layer in `bill_service`. That is a backend project, not a frontend one.
2. **App count** — 3 new apps as proposed (Shop, Hotel Desk, Linen Room), or
   fold Linen Room into Hotel Desk as a restricted role?
3. **Repo layout** — Option A (monorepo, recommended) or Option B (three repos)?
4. **`quotations-ui` future** — keep it as Laundry Ops indefinitely, or later
   strip it down to laundry-only once the other apps are live?

Until these are answered, no code is written and no existing file is modified.
