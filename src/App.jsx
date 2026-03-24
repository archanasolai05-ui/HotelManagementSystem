// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { PermissionProvider } from './context/PermissionContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Billing from './pages/Billing';
import Permissions from './pages/Permissions';

// Layout wrapper — adds Sidebar to all protected pages
function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{
        marginLeft: '240px',
        flex: 1,
        minHeight: '100vh',
        backgroundColor: '#f8f9fa',
        padding: '24px',
      }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <Toaster position="top-right" />
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes — all wrapped in Sidebar layout */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>
            }/>

            <Route path="/users" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                <AppLayout><Users /></AppLayout>
              </ProtectedRoute>
            }/>

            <Route path="/rooms" element={
              <ProtectedRoute>
                <AppLayout><Rooms /></AppLayout>
              </ProtectedRoute>
            }/>

            <Route path="/bookings" element={
              <ProtectedRoute>
                <AppLayout><Bookings /></AppLayout>
              </ProtectedRoute>
            }/>

            <Route path="/billing" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']}>
                <AppLayout><Billing /></AppLayout>
              </ProtectedRoute>
            }/>

            <Route path="/permissions" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <AppLayout><Permissions /></AppLayout>
              </ProtectedRoute>
            }/>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}