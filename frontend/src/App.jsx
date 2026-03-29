import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Unauthorized from './pages/Unauthorized'
import AdminDashboard from './pages/admin/AdminDashboard'
import ProfessionalDashboard from './pages/admin/ProfessionalDashboard'
import Patients from './pages/professional/Patients'
import PatientDetail from './pages/professional/PatientDetail'
import ConnectProfessional from './pages/ConnectProfessional'
import Consultations from './pages/professional/Consultations'
import UserManagement from './pages/admin/UserManagement'
import AdminResources from './pages/admin/AdminResources'
import Screening from './pages/Screening'
import ScreeningHistory from './pages/ScreeningHistory'
import ScreeningResultDetail from './pages/ScreeningResult'
import Journal from './pages/Journal'
import Resources from './pages/Resources'
import Tasks from './pages/Tasks'
import TaskPlayer from './pages/TaskPlayer'
import TaskHistory from './pages/TaskHistory'
import Profile from './pages/Profile'
import Analysis from './pages/Analysis'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            } 
          />
          
          {/* Protected routes - any authenticated user */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          {/* Screening routes */}
          <Route
            path="/screening"
            element={
              <ProtectedRoute>
                <Screening />
              </ProtectedRoute>
            }
          />
          <Route
            path="/screening/history"
            element={
              <ProtectedRoute>
                <ScreeningHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/screening/results/:sessionId"
            element={
              <ProtectedRoute>
                <ScreeningResultDetail />
              </ProtectedRoute>
            }
          />
          
          {/* Journal & Resources */}
          <Route
            path="/journal"
            element={
              <ProtectedRoute>
                <Journal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <ProtectedRoute>
                <Resources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analysis"
            element={
              <ProtectedRoute>
                <Analysis />
              </ProtectedRoute>
            }
          />

          {/* Task routes */}
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:taskId/play"
            element={
              <ProtectedRoute>
                <TaskPlayer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/history"
            element={
              <ProtectedRoute>
                <TaskHistory />
              </ProtectedRoute>
            }
          />
          
          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/resources"
            element={
              <AdminRoute>
                <AdminResources />
              </AdminRoute>
            }
          />

          {/* Professional routes */}
          <Route
            path="/professional"
            element={
              <ProtectedRoute requiredRoles={["professional", "admin"]}>
                <ProfessionalDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/professional/patients"
            element={
              <ProtectedRoute requiredRoles={["professional", "admin"]}>
                <Patients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/professional/patients/:id"
            element={
              <ProtectedRoute requiredRoles={["professional", "admin"]}>
                <PatientDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/professional/consultations"
            element={
              <ProtectedRoute requiredRoles={["professional", "admin"]}>
                <Consultations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/connect-professional"
            element={
              <ProtectedRoute>
                <ConnectProfessional />
              </ProtectedRoute>
            }
          />

          {/* Profile */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          
          {/* Error pages */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* 404 - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
