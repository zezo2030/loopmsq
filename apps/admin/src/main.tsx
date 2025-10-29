import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './index.css'
import './theme.css'
import App, { ErrorBoundary } from './App.tsx'
import MainLayout from './layouts/MainLayout'
import BranchLayout from './layouts/BranchLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UsersList from './pages/users/UsersList'
import UserDetail from './pages/users/UserDetail'
import CreateStaff from './pages/users/CreateStaff'
import CreateBranchManager from './pages/users/CreateBranchManager'
import BookingsList from './pages/bookings/BookingsList'
import BookingDetail from './pages/bookings/BookingDetail'
import TripsList from './pages/trips/TripsList'
import TripDetail from './pages/trips/TripDetail'
import EventsList from './pages/events/EventsList'
import EventDetail from './pages/events/EventDetail'
import Notifications from './pages/notifications/Notifications'
import Banners from './pages/cms/Banners'
import Offers from './pages/cms/Offers'
import Coupons from './pages/cms/Coupons'
import Packages from './pages/cms/Packages'
import PaymentsList from './pages/finance/PaymentsList'
import PaymentDetail from './pages/finance/PaymentDetail'
import Loyalty from './pages/marketing/Loyalty'
import Referrals from './pages/marketing/Referrals'
import WalletsList from './pages/finance/WalletsList'
import Branches from './pages/content/Branches'
import Halls from './pages/content/Halls'
import Reviews from './pages/feedback/Reviews'
import Tickets from './pages/support/Tickets'
import ReportsOverview from './pages/reports/Overview'
import Settings from './pages/Settings'
import Analytics from './Analytics'
import MetaPixel from './MetaPixel'
import SearchPage from './pages/Search'
import BranchDashboard from './pages-branch/Dashboard'
import BranchInfo from './pages-branch/branch/BranchInfo'
import BranchHalls from './pages-branch/halls/HallsList'
import BranchBookings from './pages-branch/bookings/BookingsList'
import BranchStaff from './pages-branch/staff/StaffList'
import BranchReports from './pages-branch/reports/Overview'
import { useAuth } from './shared/auth'

function RequireRoles(props: { roles: string[]; element: any }) {
  const { roles, element } = props
  const Guarded = () => {
    const { me, status } = useAuth()
    if (status === 'loading') return null
    const allowed = me?.roles?.some(r => roles.includes(r))
    return allowed ? element : <Navigate to="/login" replace />
  }
  return <Guarded />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <App />, // neutral guard layer
    children: [
      { index: true, element: <RootRedirect /> },
      {
        path: '/admin',
        element: <RequireRoles roles={['admin']} element={<MainLayout />} />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'dashboard', element: <Dashboard /> },
      
          // Users Management
          { path: 'users', element: <UsersList /> },
          { path: 'users/:id', element: <UserDetail /> },
          { path: 'staff/new', element: <CreateStaff /> },
          { path: 'branch-managers/new', element: <CreateBranchManager /> },
      
          // Bookings Management
          { path: 'bookings', element: <BookingsList /> },
          { path: 'bookings/:id', element: <BookingDetail /> },
      
          // School Trips Management
          { path: 'trips', element: <TripsList /> },
          { path: 'trips/:id', element: <TripDetail /> },
      
          // Special Events Management
          { path: 'events', element: <EventsList /> },
          { path: 'events/:id', element: <EventDetail /> },

          // Notifications
          { path: 'notifications', element: <Notifications /> },

          // CMS
          { path: 'cms/banners', element: <Banners /> },
          { path: 'cms/offers', element: <Offers /> },
          { path: 'cms/coupons', element: <Coupons /> },
          { path: 'cms/packages', element: <Packages /> },

          // Content
          { path: 'content/branches', element: <Branches /> },
          { path: 'content/halls', element: <Halls /> },

          // Finance
          { path: 'finance/payments', element: <PaymentsList /> },
          { path: 'finance/payments/:id', element: <PaymentDetail /> },
          { path: 'finance/wallets', element: <WalletsList /> },

          // Marketing
          { path: 'marketing/loyalty', element: <Loyalty /> },
          { path: 'marketing/referrals', element: <Referrals /> },

          // Feedback/Support/Reports
          { path: 'feedback/reviews', element: <Reviews /> },
          { path: 'support/tickets', element: <Tickets /> },
          { path: 'reports/overview', element: <ReportsOverview /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
      {
        path: '/branch',
        element: <RequireRoles roles={['branch_manager']} element={<BranchLayout />} />,
        children: [
          { index: true, element: <BranchDashboard /> },
          { path: 'branch', element: <BranchInfo /> },
          { path: 'halls', element: <BranchHalls /> },
          { path: 'offers', element: <Offers /> },
          { path: 'coupons', element: <Coupons /> },
          { path: 'bookings', element: <BranchBookings /> },
          { path: 'staff', element: <BranchStaff /> },
          { path: 'reports', element: <BranchReports /> },
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
        <Analytics />
        <MetaPixel />
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)

function RootRedirect() {
  try {
    const mode = localStorage.getItem('ui_mode')
    if (mode === 'branch') return <Navigate to="/branch" replace />
  } catch {}
  return <Navigate to="/admin" replace />
}
