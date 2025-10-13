import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './index.css'
import './theme.css'
import App from './App.tsx'
import MainLayout from './layouts/MainLayout'
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

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <App /> },
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
    ],
  },
])

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
