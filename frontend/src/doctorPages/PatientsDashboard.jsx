import React, { useState, useEffect } from "react";
import './PatientsDashboard.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard-error">
          <h2>Something went wrong with the dashboard</h2>
          <button onClick={() => window.location.reload()} className="retry-button">
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function Dashboard() {
  const [user, setUser] = useState(null)
  const [dashboardData, setDashboardData] = useState({
    upcomingAppointments: [],
    todaysAppointments: [],
    todaysPatients: [],
    pendingTasks: [],
    notifications: [],
    stats: {
      totalPatients: 0,
      todayAppointments: 0,
      pendingAlerts: 0,
      unreadMessages: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [showAlertsModal, setShowAlertsModal] = useState(false)
  const [pendingAlerts, setPendingAlerts] = useState([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)

  const viewAppointmentDetails = (appointment) => {
    setSelectedAppointment(appointment)
    setShowAppointmentModal(true)
  }

  const viewPendingAlerts = async () => {
    setLoadingAlerts(true)
    setShowAlertsModal(true)
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/doctor/alerts/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const alerts = await response.json()
        setPendingAlerts(alerts)
      }
    } catch (error) {
      console.error('Error fetching pending alerts:', error)
    } finally {
      setLoadingAlerts(false)
    }
  }

  const markAlertAsRead = async (alertId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3001/api/doctor/alerts/${alertId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        setPendingAlerts(prev => prev.map(alert => 
          alert.alert_id === alertId ? { ...alert, is_read: true } : alert
        ))
        // Refresh dashboard data to update pending alerts count
        fetchDashboardData()
      }
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }

  useEffect(() => {
    fetchUserData()
    fetchDashboardData()
  }, [])

  const fetchUserData = async () => {
    try {
      const userID = localStorage.getItem('userID')
      const token = localStorage.getItem('token')
      
      if (!userID || !token) return
      
      const response = await fetch(`http://localhost:3001/api/auth/users/${userID}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      // Fetch all dashboard data
      const [appointmentsRes, patientsRes, conversationsRes] = await Promise.all([
        fetch('http://localhost:3001/api/appointments/doctor', { headers }),
        fetch('http://localhost:3001/api/doctor/patients', { headers }),
        fetch('http://localhost:3001/api/messages/conversations', { headers })
      ])

      const appointments = appointmentsRes.ok ? await appointmentsRes.json() : []
      const patients = patientsRes.ok ? await patientsRes.json() : []
      const conversations = conversationsRes.ok ? await conversationsRes.json() : []

      // Calculate total unread messages
      const totalUnreadMessages = conversations.reduce((sum, conv) => sum + (parseInt(conv.unread_count) || 0), 0)
      
      // Calculate pending alerts
      const pendingAlerts = patients.reduce((sum, p) => sum + (parseInt(p.alert_count) || 0), 0)
      
      console.log('Total unread messages:', totalUnreadMessages)
      console.log('Pending alerts:', pendingAlerts)
      console.log('Patients data:', patients)
      console.log('Conversations data:', conversations)

      // Process data - fix date comparison
      const today = new Date()
      const todayString = today.getFullYear() + '-' + 
                         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(today.getDate()).padStart(2, '0')
      
      // Today's appointments (all appointments for today)
      const todaysAppointments = appointments
        .filter(apt => {
          const aptDateString = apt.appointment_date.split('T')[0]
          return aptDateString === todayString
        })
        .map(apt => ({
          ...apt,
          patient: patients.find(p => p.user_id === apt.patient_id)
        }))
        .sort((a, b) => a.start_time.localeCompare(b.start_time))

      // Upcoming appointments (future appointments, not including today)
      const upcomingAppointments = appointments
        .filter(apt => {
          const aptDateString = apt.appointment_date.split('T')[0]
          return aptDateString > todayString
        })
        .sort((a, b) => {
          const dateA = new Date(a.appointment_date + 'T' + a.start_time)
          const dateB = new Date(b.appointment_date + 'T' + b.start_time)
          return dateA - dateB
        })
        .slice(0, 5)
        .map(apt => ({
          ...apt,
          patient: patients.find(p => p.user_id === apt.patient_id)
        }))

      // Today's patients (unique patients with appointments today)
      const todaysPatients = todaysAppointments.reduce((unique, apt) => {
        if (!unique.find(p => p.patient_id === apt.patient_id)) {
          unique.push(apt)
        }
        return unique
      }, [])

      setDashboardData({
        upcomingAppointments,
        todaysAppointments,
        todaysPatients,
        pendingTasks: [
          { id: 1, type: 'message', title: 'Unread Messages', count: totalUnreadMessages, priority: 'medium' },
          { id: 2, type: 'prescription', title: 'Prescription Requests', count: 2, priority: 'high' },
          { id: 3, type: 'results', title: 'Pending Test Results', count: 1, priority: 'urgent' }
        ],
        notifications: [],
        stats: {
          totalPatients: patients.length,
          todayAppointments: todaysAppointments.length,
          pendingAlerts: pendingAlerts,
          unreadMessages: totalUnreadMessages
        }
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'morning'
    if (hour < 17) return 'afternoon'
    return 'evening'
  }

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#ff4757'
      case 'high': return '#ff6b6b'
      case 'medium': return '#ffa502'
      default: return '#00fbcd'
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Good {getTimeOfDay()}, Dr. {user?.last_name || 'Doctor'}!</h1>
        <p>Here's your practice overview for today</p>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Total Patients</h3>
            <div className="stat-value">{dashboardData.stats.totalPatients}</div>
          </div>
        </div>
        <div className="stat-card" onClick={dashboardData.stats.pendingAlerts > 0 ? viewPendingAlerts : undefined} style={{ cursor: dashboardData.stats.pendingAlerts > 0 ? 'pointer' : 'default' }}>
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>Pending Alerts</h3>
            <div className="stat-value">{dashboardData.stats.pendingAlerts}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <h3>Unread Messages</h3>
            <div className="stat-value">{dashboardData.stats.unreadMessages}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Today's Appointments */}
        <div className="dashboard-section">
          <h2>Today's Appointments</h2>
          <div className="appointments-list">
            {dashboardData.todaysAppointments.length === 0 ? (
              <div className="empty-state">
                <p>No appointments scheduled for today</p>
              </div>
            ) : (
              dashboardData.todaysAppointments.map(appointment => (
                <div key={appointment.appointment_id} className="appointment-card">
                  <div className="appointment-time">
                    <div className="date">Today</div>
                    <div className="time">{formatTime(appointment.start_time)}</div>
                  </div>
                  <div className="appointment-details">
                    <h4>{appointment.first_name} {appointment.last_name}</h4>
                    <p className="appointment-type">{appointment.appointment_type}</p>
                    {appointment.symptoms && (
                      <p className="symptoms">Symptoms: {appointment.symptoms}</p>
                    )}
                  </div>
                  <div className="appointment-actions">
                    <button 
                      className="btn-secondary"
                      onClick={() => viewAppointmentDetails(appointment)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="dashboard-section">
          <h2>Upcoming Appointments</h2>
          <div className="appointments-list">
            {dashboardData.upcomingAppointments.length === 0 ? (
              <div className="empty-state">
                <p>No upcoming appointments</p>
              </div>
            ) : (
              dashboardData.upcomingAppointments.map(appointment => (
                <div key={appointment.appointment_id} className="appointment-card">
                  <div className="appointment-time">
                    <div className="date">{formatDate(appointment.appointment_date)}</div>
                    <div className="time">{formatTime(appointment.start_time)}</div>
                  </div>
                  <div className="appointment-details">
                    <h4>{appointment.first_name} {appointment.last_name}</h4>
                    <p className="appointment-type">{appointment.appointment_type}</p>
                    {appointment.symptoms && (
                      <p className="symptoms">Symptoms: {appointment.symptoms}</p>
                    )}
                  </div>
                  <div className="appointment-actions">
                    <button 
                      className="btn-secondary"
                      onClick={() => viewAppointmentDetails(appointment)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-sidebar">
        {/* Pending Tasks */}
        <div className="dashboard-section">
          <h2>Pending Tasks</h2>
          <div className="tasks-list">
            {dashboardData.pendingTasks.map(task => (
              <div 
                key={task.id} 
                className="task-card"
                onClick={task.count > 0 ? viewPendingAlerts : undefined}
                style={{ cursor: task.count > 0 ? 'pointer' : 'default' }}
              >
                <div className="task-info">
                  <h4>{task.title}</h4>
                  <span className="task-count" style={{ color: getPriorityColor(task.priority) }}>
                    {task.count} pending
                  </span>
                </div>
                <div className="task-priority" style={{ backgroundColor: getPriorityColor(task.priority) }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Appointment Details Modal */}
      {showAppointmentModal && selectedAppointment && (
        <div className="modal-overlay" onClick={() => setShowAppointmentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Appointment Details</h2>
              <button 
                className="modal-close"
                onClick={() => setShowAppointmentModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="appointment-detail-grid">
                <div className="detail-item">
                  <label>Patient</label>
                  <p>{selectedAppointment.first_name} {selectedAppointment.last_name}</p>
                </div>
                <div className="detail-item">
                  <label>Date</label>
                  <p>{formatDate(selectedAppointment.appointment_date)}</p>
                </div>
                <div className="detail-item">
                  <label>Time</label>
                  <p>{formatTime(selectedAppointment.start_time)} - {formatTime(selectedAppointment.end_time)}</p>
                </div>
                <div className="detail-item">
                  <label>Type</label>
                  <p>{selectedAppointment.appointment_type}</p>
                </div>
                {selectedAppointment.symptoms && (
                  <div className="detail-item">
                    <label>Symptoms</label>
                    <p>{selectedAppointment.symptoms}</p>
                  </div>
                )}
                {selectedAppointment.notes && (
                  <div className="detail-item full-width">
                    <label>Notes</label>
                    <p>{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Modal */}
      {showAlertsModal && (
        <div className="modal-overlay" onClick={() => setShowAlertsModal(false)}>
          <div className="modal-content alerts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Pending Patient Alerts</h2>
              <button 
                className="modal-close"
                onClick={() => setShowAlertsModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {loadingAlerts ? (
                <div className="alerts-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading alerts...</p>
                </div>
              ) : pendingAlerts.length === 0 ? (
                <div className="no-alerts">
                  <p>No pending alerts to review</p>
                </div>
              ) : (
                <div className="alerts-list">
                  {pendingAlerts.map(alert => (
                    <div key={alert.alert_id} className={`alert-card ${alert.severity}`}>
                      <div className="alert-header">
                        <div className="alert-patient">
                          <h4>{alert.patient_name}</h4>
                          <span className="alert-time">
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="alert-severity">
                          <span className={`severity-badge ${alert.severity}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="alert-content">
                        <h3>{alert.title}</h3>
                        <p>{alert.message}</p>
                        
                        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                          <div className="alert-metadata">
                            <strong>Details:</strong>
                            <ul>
                              {Object.entries(alert.metadata).map(([key, value]) => (
                                <li key={key}>
                                  <span>{key.replace(/_/g, ' ')}:</span>
                                  <span>{value}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      <div className="alert-actions">
                        {alert.is_read ? (
                          <span className="read-status">✅ Reviewed</span>
                        ) : (
                          <button 
                            className="mark-read-btn"
                            onClick={() => markAlertAsRead(alert.alert_id)}
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  )
}
