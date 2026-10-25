# LoveLaundry — Test Report

**Prepared for:** Rasindu Dulshan Siriwardhana
**Date:** 24 October 2026
**Scope:** hotel client-account identity, hotel portal API, and the three new apps
(Shop Counter, Hotel Desk, Linen Room)

---

## 1. Result summary

| Component | Command | Result |
|---|---|---|
| `user-service` | `pytest tests/ -q` | **68 passed**, 9 warnings, 42.12s |
| `bill_service` | `pytest tests/ -q --ignore=tests/test_security_middleware.py` | **380 passed**, 2 skipped, 12 warnings, 13.64s |
| `shop-app` | `npm run build` (`tsc --noEmit && vite build`) | **built in 0.44s** |
| `hotel-app` | `npm run build` | **built in 0.49s** |
| `linen-room-app` | `npm run build` | **built in 0.43s** |
| System manual | section + PDF page count | **133 sections / 133 PDF pages**, 3.52 MB, Spectral embedded |

No failing assertions in any suite that could be collected. The one uncollected file is
explained in §5.

---

## 2. What was added and why it needed testing

### 2.1 Hotel client identity (`user-service`)

Hotels existed only as the `client_name` string on gate passes, deliveries, bills and
quotations — so a hotel had no identity to sign in with. To add one without weakening the
staff API, client tokens are issued **without** `laundry_id` and **without** `laundries`.

That absence is the security mechanism: `bill_service/tenancy.py::resolve_laundry_id`
fails closed when those claims are missing, so **every existing endpoint rejects a hotel
token with no change to any existing endpoint**. The tests pin that negative contract so a
future "helpful" addition of a `laundry_id` claim cannot silently open the staff API.

`tests/test_client_accounts.py` — 13 tests:

| Test | Property asserted |
|---|---|
| `test_client_token_carries_no_laundry_membership_claim` | no `laundry_id`, no `laundries`, `token_kind=client`, `platform_admin=False` |
| `test_client_token_is_shorter_lived_than_a_staff_token` | 12-hour client session |
| `test_login_returns_a_working_client_session` | login → token → `/client/auth/status` returns the hotel scope |
| `test_unknown_and_wrong_password_are_indistinguishable` | identical status **and** message for both |
| `test_suspended_account_cannot_sign_in` | 403 on login |
| `test_session_dies_when_the_account_is_suspended` | an issued token stops working after suspension |
| `test_staff_endpoint_rejects_a_client_token` | `/auth/status` → 401 |
| `test_client_endpoint_rejects_a_staff_token` | `/client/auth/status` → 403 |
| `test_same_login_twice_in_one_laundry_is_rejected` | 409 duplicate |
| `test_same_login_is_allowed_in_another_laundry` | per-laundry uniqueness only |
| `test_client_name_is_validated` | blank and control characters rejected |
| `test_role_must_be_a_hotel_role` | `ADMIN` rejected for a client account |
| `test_password_hash_is_never_returned` | `public_view` omits the hash |

### 2.2 Hotel portal API (`bill_service`)

`tests/test_client_portal.py` — 13 tests covering scope resolution, isolation and money:

- staff token → 403 on the portal; client token → 400/403 on staff endpoints
- a hotel sees only its own gate passes, deliveries and bills
- the **same hotel name under a different laundry never leaks in**
- outstanding balance = `grand_total − paid_amount`, computed from stored values
- cancelled bills are excluded from outstanding
- another hotel's invoice id returns **404, not 403**, so ids cannot be probed
- gate passes whose work is finished are excluded from the "open" count
- returned documents are decrypted, not raw ciphertext

The existing 354 tests in the suite were re-run unchanged: registering the new router did
not alter any prior behaviour.

---

## 3. Defects found and fixed during this work

1. **Test run connecting to the production database.** `auth_helper.py` calls
   `load_dotenv()` at import. Importing it before the database handle made `config` resolve
   the real `MONGODB_MAIN_URI`, and the test run dialled the production Atlas cluster
   (DNS timeout observed). Fixed by importing the database handle first and documenting
   that the order is load-bearing.
2. **`lucide-react` 1.61 ships no types** under `moduleResolution: bundler`, breaking
   `tsc --noEmit`. Removed the dependency and inlined the one icon used.
3. **Interrupted `npm install`** left `node_modules/.bin` incomplete (`tsc` missing) in two
   apps. Reinstalled and re-verified.
4. **Test seeds written to the wrong collection.** The harness names mocked collections
   after the Python attribute (`bills_collection`), not the Mongo collection (`bills`), so
   the first isolation tests passed trivially against an empty collection. Corrected — this
   is exactly the kind of false positive the tests exist to prevent.

---

## 4. How to reproduce

```bash
# user-service
cd user-service && .venv\Scripts\python -m pytest tests/ -q

# bill_service
cd bill_service && .venv\Scripts\python -m pytest tests/ -q --ignore=tests/test_security_middleware.py

# apps
cd shop-app        && npm ci && npm run build
cd hotel-app       && npm ci && npm run build
cd linen-room-app  && npm ci && npm run build
```

---

## 5. Known limitations — what is **not** proven

Stated plainly because a test report that overstates coverage is worse than none.

1. **`tests/test_security_middleware.py` cannot be collected** in this virtualenv:
   `ModuleNotFoundError: httpx2`, followed by `click has no attribute command`. This is a
   local dependency gap that predates this work, not a product defect. It is excluded
   above, so the 380 figure excludes that file.
2. **No browser-driven end-to-end suite.** The three apps are type-checked and built, and
   their request/response shapes were matched against the actual FastAPI signatures — but
   they have not been clicked through against a live database in this session. Login →
   render → save flows are therefore verified by construction, not by execution.
3. **No load or performance testing.** Concurrency guarantees are covered only by the
   existing unit-level tests (`test_payment_concurrency`, `test_sync_worker_races`).
4. **The manual's operational targets** (RPO/RTO figures) are documented policy, not
   measured recovery timings, because no restore drill has been run against production.
5. **Nothing has been deployed.** No commit, push, Vercel build or database migration was
   performed in this session.

---

## 6. Recommended next verification

1. Seed one laundry with two hotels and one shop, then click through each app against a
   staging backend — the highest-value missing check.
2. Open the Hotel Desk app with a hotel token and confirm the browser cannot reach any
   staff endpoint (the server says no; confirm the UI never offers it).
3. Run one restore drill from a real backup and replace the manual's RPO/RTO table with
   measured timings.
4. Add `httpx2` to the test environment so the middleware suite runs in CI.
