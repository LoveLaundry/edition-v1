# LoveLaundry System - Incomplete Features & Missing UI Audit

**Date**: 2026-10-27
**Status**: In Progress

## Executive Summary

This audit identifies incomplete features, missing UI components, and features requiring changes across the LoveLaundry system.

---

## 1. Backend API Status

### ✅ Implemented Endpoints

#### Client Portal (`/client-portal`)
- **GET /client-portal/summary** - Hotel dashboard summary ✅
- **GET /client-portal/gate-passes** - Gate passes list ✅
- **GET /client-portal/deliveries** - Deliveries list ✅
- **GET /client-portal/bills** - Bills list ✅

#### Linen Management
- All linen endpoints implemented ✅
- Scan operations ✅
- Inventory endpoints ✅

### ❌ Missing or Incomplete Backend Features

#### Shop Portal Endpoints
- **GET /client-portal/shop/summary** - Referenced in shop-app config but NOT IMPLEMENTED
- **GET /client-portal/shop/bills** - Referenced in shop-app config but NOT IMPLEMENTED

**Evidence**: 
- `edition-v1/shop-app/src/config/app.ts` line 25 references `GET /client-portal/shop/summary`
- `edition-v1/shop-app/src/config/app.ts` line 31 references `GET /client-portal/shop/bills`
- `edition-v1/bill_service/src/bill_service/routers/client_portal.py` does NOT contain these endpoints
- `edition-v1/bill_service/src/bill_service/routers/client_shop_orders.py` exists but needs review

#### Monthly Operations
- **GET /client-portal/monthly** - Hotel monthly matrix - NOT IMPLEMENTED
- **GET /client-portal/statements** - Hotel statements - NOT IMPLEMENTED

**Evidence**:
- APP_SPLIT_PLAN.md mentions "monthly quantities, invoices, statements" for Hotel Desk
- No corresponding endpoints found in client_portal.py

---

## 2. Frontend App Status

### Hotel App (`edition-v1/hotel-app`)

#### ✅ Implemented Pages
- OverviewPage - Basic stats display ✅
- GatePassesPage - ✅
- DeliveriesPage - ✅
- InvoicesPage - ✅
- SectionPage - ✅

#### ❌ Missing Features
- **Monthly Matrix Page** - Not in navigation, not implemented
- **Statements Page** - Not in navigation, not implemented
- **Settings/Profile** - No user settings page

**Recommendation**: Add monthly matrix and statements pages to hotel-app navigation

---

### Shop App (`edition-v1/shop-app`)

#### ✅ Implemented Pages
- NewOrderPage - ✅
- BillsPage - ✅
- AccountPage - ✅

#### ❌ Missing Features
- **Day Close Page** - APP_SPLIT_PLAN.md mentions "day close" for shop but not implemented
- **Quick Bill Template** - Not in navigation
- **Shop Client Balances** - Referenced in architecture but not in UI

**Recommendation**: Add day close functionality and shop client balances page

---

### Linen Room App (`edition-v1/linen-room-app`)

#### ✅ Implemented Pages
- ScanPage - ✅
- InventoryPage - ✅
- DiscrepanciesPage - ✅
- TagsPage - ✅
- SectionPage - ✅

#### ❌ Missing Features
- **Bulk Scan Page** - Referenced in APP_SPLIT_PLAN.md but not in navigation
- **Stats/Summary Page** - Referenced but might be same as DiscrepanciesPage

**Recommendation**: Verify if bulk scan needs separate page or if ScanPage covers it

---

## 3. Quotations UI (Main Monolith)

### ✅ Fully Implemented Features
- Gate pass management
- Quotations
- Linen tracking
- Shop bills
- Workers management
- Daily tasks
- Reports
- AI chat

### ❌ Incomplete or Missing
- **Guest Billing Integration** - Separate guest-billing app exists but integration unclear
- **Real-time Sync Status** - Sync infrastructure exists but UI feedback may be incomplete

---

## 4. User Service

### ❌ Missing Features
- **Client Account Management** - client_accounts.py exists but no dedicated UI
- **Hotel/Shop Client Onboarding** - No UI for creating hotel/shop client accounts
- **Self-Service Password Reset** - Not implemented in UI

---

## 5. Worker Service

### ❌ Missing Features
- **Mobile Worker App** - No dedicated mobile UI for workers
- **Task Assignment UI** - Tasks exist but assignment workflow may need UI improvements

---

## 6. Laundry Management

### ❌ Missing Features
- **Advanced Reporting** - Basic reports exist but may need more comprehensive dashboard
- **Multi-currency Support** - System uses LKR but multi-currency not in UI
- **Tax Configuration** - No tax settings UI visible

---

## 7. Architecture vs Implementation Gaps

### APP_SPLIT_PLAN.md Status
The document states: **"Status: awaiting approval. No code has been written for the new apps yet."**

**Reality**: Apps ARE written (hotel-app, shop-app, linen-room-app exist) but may be incomplete relative to the plan.

### Gap Analysis

| Feature | Planned (APP_SPLIT_PLAN.md) | Implemented | Gap |
|---------|----------------------------|-------------|-----|
| Shop Counter - Day Close | ✅ | ❌ | Missing |
| Shop Counter - Day Money | ✅ | ❌ | Missing |
| Hotel Desk - Monthly Matrix | ✅ | ❌ | Missing |
| Hotel Desk - Statements | ✅ | ❌ | Missing |
| Linen Room - Bulk Scan | ✅ | ❓ | Unclear |
| Linen Room - Stats/Summary | ✅ | ✅ | Implemented |

---

## 8. Priority Recommendations

### High Priority (Blockers)
1. **Implement Shop Portal Backend Endpoints** - shop/summary and shop/bills
2. **Implement Hotel Monthly Matrix** - Both backend and frontend
3. **Implement Hotel Statements** - Both backend and frontend
4. **Implement Shop Day Close** - Backend and frontend

### Medium Priority (Enhancements)
5. Add bulk scan page to linen-room-app if needed
6. Add client account management UI
7. Add hotel/shop client onboarding UI
8. Improve worker task assignment UI

### Low Priority (Nice to Have)
9. Self-service password reset
10. Multi-currency support
11. Tax configuration UI
12. Advanced reporting dashboard

---

## 9. Next Steps

1. Implement missing backend endpoints in client_portal.py
2. Add missing pages to frontend apps
3. Update navigation configs
4. Test end-to-end flows
5. Update documentation

---

## 10. Dependencies

Implementing these features will require:
- Backend: Add endpoints to `bill_service/src/bill_service/routers/client_portal.py`
- Frontend: Create new page components in respective apps
- Testing: Verify tenant isolation and client scope enforcement
- Documentation: Update API docs and user guides
