# Registering hotels, shops and their staff

Every account below belongs to exactly one **laundry** (the business that does
the washing) and, for client accounts, to exactly one **customer name** — the
hotel or shop. That pair is what isolates data: a hotel sees only its own
records, and the same login may be registered at several laundries as separate
accounts.

Two kinds of client account exist:

| Side | `client_type` | Roles |
|---|---|---|
| Hotel | `HOTEL` | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| Shop | `SHOP` | `SHOP_ADMIN`, `SHOP_STAFF` |

`*_ADMIN` may add colleagues on its own side. `*_MANAGER` / `SHOP_STAFF` cannot.

---

## 1. Register a hotel (first account)

A **laundry administrator** creates the hotel's first account. That account is
the hotel's administrator.

```bash
curl -X POST http://localhost/api/user/clients \
  -H "Authorization: Bearer <LAUNDRY_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "client_type": "HOTEL",
        "role": "HOTEL_ADMIN",
        "client_name": "Cinnamon Grand",
        "auth_id": "cinnamon.admin",
        "user_name": "Front Office Manager",
        "password": "choose-a-strong-one",
        "email": "fo@cinnamongrand.example"
      }'
```

- `client_name` is the hotel's identity. Use one spelling everywhere — records
  are matched on it exactly, so "Cinnamon Grand" and "cinnamon grand" are two
  different hotels.
- `auth_id` must be unique **within that laundry**; the same `auth_id` may exist
  at another laundry.
- The laundry comes from the caller's token. A laundry admin cannot create an
  account in someone else's laundry.

**409** means that `auth_id` already exists in this laundry.
**400** means the role does not belong to `client_type`.

## 2. Register a hotel administrator (another one)

Same call as above with `"role": "HOTEL_ADMIN"`. Only a laundry administrator
can mint an administrator; a hotel administrator cannot create another one.

## 3. Register hotel staff

Two routes, same result:

**a. By the laundry administrator** — `POST /clients` with
`"role": "HOTEL_MANAGER"` and the same `client_name`.

**b. By the hotel administrator** — signing in as that hotel:

```bash
curl -X POST http://localhost/api/user/client/staff \
  -H "Authorization: Bearer <HOTEL_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "auth_id": "cinnamon.housekeeping",
        "user_name": "Housekeeping Supervisor",
        "password": "another-strong-one"
      }'
```

The laundry and `client_name` are taken from the token, not the body, so this
call cannot enrol staff into a different hotel. `role` defaults to
`HOTEL_MANAGER`; any other role is refused with **400**.

`GET /client/staff` lists everyone under the caller's own hotel.

## 4. Register a shop user

Identical flow, `client_type: "SHOP"`:

```bash
# Shop's first account — laundry administrator
curl -X POST http://localhost/api/user/clients \
  -H "Authorization: Bearer <LAUNDRY_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "client_type": "SHOP",
        "role": "SHOP_ADMIN",
        "client_name": "Raman Stores",
        "auth_id": "raman.owner",
        "user_name": "Raman",
        "password": "choose-a-strong-one"
      }'

# Additional shop staff — the shop administrator
curl -X POST http://localhost/api/user/client/staff \
  -H "Authorization: Bearer <SHOP_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"auth_id": "raman.counter", "user_name": "Counter", "password": "..."}'
```

`role` defaults to `SHOP_STAFF`.

---

## Signing in

Client accounts have their own login — they are not staff accounts and cannot
use `/auth/login`:

```bash
curl -X POST http://localhost/api/user/client/auth/login \
  -H "Content-Type: application/json" \
  -d '{"auth_id": "cinnamon.admin", "password": "...", "client_type": "HOTEL"}'
```

- **409 `laundry_required`** — the same login exists at several laundries.
  Repeat the call with `"laundry_id": "<one of the returned ids>"`.
- A client token carries `client_scope` and **no** `laundry_id`/`laundries`
  claims. That is what makes every staff endpoint reject it automatically.

Useful follow-ups:

| Call | Purpose |
|---|---|
| `GET /client/auth/status` | Confirm the session and see its scope |
| `GET /client/auth/laundries` | List every laundry this login belongs to |
| `POST /client/auth/switch` | Re-issue the token for another of those laundries |
| `POST /client/auth/refresh` | New expiry, claims re-read from the database |

## Managing accounts

| Call | Who | Effect |
|---|---|---|
| `PATCH /clients/{id}/status` | laundry admin | `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| `GET /clients` | laundry admin | All client accounts in the laundry |

Suspending takes effect at the next refresh or sign-in; an outstanding token
keeps working until it expires (12 hours) unless it is refreshed.

## Quick role matrix

| Action | Laundry admin | Hotel admin | Hotel manager | Shop admin | Shop staff |
|---|---|---|---|---|---|
| Create hotel / shop | yes | no | no | no | no |
| Create another admin | yes | no | no | no | no |
| Create own staff | yes | yes | no | yes | no |
| Read own records | n/a | yes | yes | yes | yes |
| Raise a shop order | n/a | no | no | yes | yes |
| Confirm receipt | staff endpoints | no | no | no | no |
