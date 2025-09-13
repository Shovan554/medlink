import React from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Navigation from './components/Navigation'
import DoctorNavigation from './components/DoctorNavigation'
import Dashboard from './patientPages/Dashboard'
import Trends from './patientPages/Trends'
import Messages from './patientPages/Messages'
import Alerts from './patientPages/Alerts'
import Reports from './patientPages/Reports'
import Settings from './patientPages/Settings'
import Login from './patientPages/Login'
import Signup from './patientPages/Signup'
import LoadingPage from './patientPages/LoadingPage'
import PatientsDashboard from './doctorPages/PatientsDashboard'
import Patients from './doctorPages/Patients'
import Calendar from './doctorPages/Calendar'
import DoctorReports from './doctorPages/DoctorsReport'
import DoctorSettings from './doctorPages/DoctorSettings'
import DoctorMessages from './doctorPages/Messages'
import { isTokenExpired, handleTokenExpiration } from './utils/auth'

function MainLayout({ children, userRole }) {
  return (
    <div className="main-layout">
      {userRole === 'doctor' ? <DoctorNavigation /> : <Navigation />}
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    const hasVisitedLoading = sessionStorage.getItem('hasVisitedLoading')
    
    // Only redirect to loading page if we're on the root path and haven't visited loading
    if (!hasVisitedLoading && location.pathname === '/') {
      navigate('/')
      return
    }

    const user = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    
    if (!user || !token) {
      navigate('/login')
      return
    }
    
    // Check if token is expired
    if (isTokenExpired(token)) {
      handleTokenExpiration()
      return
    }
    
    const userData = JSON.parse(user)
    setUserRole(userData.role)
    setIsLoading(false)
  }, [navigate, location.pathname])

  if (isLoading) {
    return null
  }

  return (
    <MainLayout userRole={userRole}>
      {children}
    </MainLayout>
  )
}

function App() {
  useEffect(() => {
    // Clear the loading flag on app initialization (page refresh)
    sessionStorage.removeItem('hasVisitedLoading')
  }, [])

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoadingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/trends" element={
          <ProtectedRoute>
            <Trends />
          </ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        } />
        <Route path="/alerts" element={
          <ProtectedRoute>
            <Alerts />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/patients-dashboard" element={
          <ProtectedRoute>
            <PatientsDashboard />
          </ProtectedRoute>
        } />
        <Route path="/patients" element={
          <ProtectedRoute>
            <Patients />
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute>
            <Calendar />
          </ProtectedRoute>
        } />
        <Route path="/doctor-settings" element={
          <ProtectedRoute>
            <DoctorSettings />
          </ProtectedRoute>
        } />
        <Route path="/doctor-messages" element={
          <ProtectedRoute>
            <DoctorMessages />
          </ProtectedRoute>
        } />
        <Route path="/doctor-reports" element={
          <ProtectedRoute>
            <DoctorReports />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
