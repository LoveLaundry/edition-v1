import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { RegisterPage } from './auth/RegisterPage'
import { AppShell } from './shell/AppShell'
import { TodayPage } from './pages/TodayPage'
import { BillsPage } from './pages/BillsPage'
import { OrdersPage } from './pages/OrdersPage'
import { NewOrderPage } from './pages/NewOrderPage'
import { QuickBillPage } from './pages/QuickBillPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<TodayPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/new" element={<NewOrderPage />} />
            <Route path="quick-bill" element={<QuickBillPage />} />
            <Route path="bills" element={<BillsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
