import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './index.css'
import './theme.css'
import App, { ErrorBoundary } from './App.tsx'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BranchInfo from './pages/branch/BranchInfo'
import HallsList from './pages/halls/HallsList'
import BookingsList from './pages/bookings/BookingsList'
import StaffList from './pages/staff/StaffList'
import ReportsOverview from './pages/reports/Overview'
import BranchOffers from './pages/cms/BranchOffers'
import BranchCoupons from './pages/cms/BranchCoupons'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <App />, // guard layer
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'branch', element: <BranchInfo /> },
          { path: 'halls', element: <HallsList /> },
          { path: 'offers', element: <BranchOffers /> },
          { path: 'coupons', element: <BranchCoupons /> },
          { path: 'bookings', element: <BookingsList /> },
          { path: 'staff', element: <StaffList /> },
          { path: 'reports', element: <ReportsOverview /> },
        ],
      },
    ],
  },
])

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
