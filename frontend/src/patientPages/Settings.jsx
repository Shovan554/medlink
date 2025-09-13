import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Dashboard.css'

function Settings() {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    mrn: '',
    blood_type: '',
    height_cm: '',
    weight_kg: ''
  })
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState(null)
  const [user, setUser] = useState(null)
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [connectedDoctor, setConnectedDoctor] = useState(null)

  useEffect(() => {
    fetchProfileData()
    fetchUserData()
    fetchConnectedDoctor()
  }, [])

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/patients/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setProfileData({
          mrn: data.mrn || '',
          blood_type: data.blood_type || '',
          height_cm: data.height_cm || '',
          weight_kg: data.weight_kg || ''
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchUserData = async () => {
    try {
      const userID = localStorage.getItem('userID')
      const token = localStorage.getItem('token')
      
      if (!userID || !token) return
      
      const response = await fetch(`http://localhost:3001/api/users/${userID}`, {
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

  const fetchConnectedDoctor = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/patients/connected-doctor', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setConnectedDoctor(data.doctor)
      }
    } catch (error) {
      console.error('Error fetching connected doctor:', error)
    }
  }

  const fetchDoctors = async () => {
    setLoadingDoctors(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/doctors/available', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setDoctors(data.doctors)
      }
    } catch (error) {
      console.error('Error fetching doctors:', error)
    } finally {
      setLoadingDoctors(false)
    }
  }

  const handleConnectToDoctor = async (doctorId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/patients/connect-doctor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ doctorId })
      })

      if (response.ok) {
        showNotification('Successfully connected to doctor!', 'success')
        setShowDoctorModal(false)
        fetchConnectedDoctor()
      } else {
        showNotification('Failed to connect to doctor', 'error')
      }
    } catch (error) {
      console.error('Error connecting to doctor:', error)
      showNotification('Error connecting to doctor', 'error')
    }
  }

  const openDoctorModal = () => {
    setShowDoctorModal(true)
    fetchDoctors()
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/patients/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      })

      if (response.ok) {
        showNotification('Profile updated successfully!', 'success')
        setIsEditing(false)
      } else {
        showNotification('Failed to update profile', 'error')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      showNotification('Error updating profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    sessionStorage.removeItem('hasVisitedLoading')
    navigate('/login')
  }

  const showNotification = (message, type) => {
    setNotification({ message, type })
    setTimeout(closeNotification, 3000)
  }

  const closeNotification = () => {
    setNotification(null)
  }

  return (
    <div style={{ 
      height: 'calc(100vh - 80px)', 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'transparent',
      position: 'absolute',
      top: '80px',
      left: '0'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '20px 30px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        flexShrink: 0
      }}>
        <h1 style={{ 
          margin: 0, 
          color: '#00fbcd', 
          fontSize: '2.5rem', 
          marginBottom: '5px' 
        }}>
          Patient Settings
        </h1>
        <p style={{ 
          margin: 0, 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '1.1rem' 
        }}>
          Manage your profile and account preferences
        </p>
      </div>

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        padding: '20px 30px',
        overflowY: 'auto'
      }}>
        {/* User Info Section */}
        {user && (
          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            marginBottom: '20px',
            width: '80%',
            margin: '0 auto 20px auto'
          }}>
            <h2 style={{ color: '#00fbcd', margin: '0 0 20px 0' }}>Account Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px', width: '100%' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>First Name:</label>
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {user.first_name}
                </span>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Last Name:</label>
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {user.last_name}
                </span>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Email:</label>
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {user.email}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Medical Profile Section */}
        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          marginBottom: '20px',
          width: '80%',
          margin: '0 auto 20px auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '25px' }}>
            <h2 style={{ color: '#00fbcd', margin: 0 }}>Medical Profile</h2>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(0, 251, 205, 0.1)',
                color: '#00fbcd',
                border: '1px solid rgba(0, 251, 205, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', width: '100%' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>MRN:</label>
              {isEditing ? (
                <input
                  type="text"
                  name="mrn"
                  value={profileData.mrn}
                  onChange={handleInputChange}
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    borderRadius: '10px', 
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '14px'
                  }}
                  placeholder="Enter MRN"
                />
              ) : (
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {profileData.mrn || 'Not set'}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Blood Type:</label>
              {isEditing ? (
                <select
                  name="blood_type"
                  value={profileData.blood_type}
                  onChange={handleInputChange}
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    borderRadius: '10px', 
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select Blood Type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              ) : (
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {profileData.blood_type || 'Not set'}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Height (cm):</label>
              {isEditing ? (
                <input
                  type="number"
                  name="height_cm"
                  value={profileData.height_cm}
                  onChange={handleInputChange}
                  min="40"
                  max="300"
                  step="0.1"
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    borderRadius: '10px', 
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '14px'
                  }}
                  placeholder="Enter height"
                />
              ) : (
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {profileData.height_cm ? `${profileData.height_cm} cm` : 'Not set'}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Weight (kg):</label>
              {isEditing ? (
                <input
                  type="number"
                  name="weight_kg"
                  value={profileData.weight_kg}
                  onChange={handleInputChange}
                  min="2"
                  max="635"
                  step="0.1"
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    borderRadius: '10px', 
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '14px'
                  }}
                  placeholder="Enter weight"
                />
              ) : (
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {profileData.weight_kg ? `${profileData.weight_kg} kg` : 'Not set'}
                </span>
              )}
            </div>
          </div>

          {isEditing && (
            <button 
              onClick={handleSaveProfile}
              disabled={loading}
              style={{
                marginTop: '25px',
                padding: '14px 28px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {/* Doctor Connection Section */}
        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          marginBottom: '20px',
          width: '80%',
          margin: '0 auto 20px auto'
        }}>
          <h2 style={{ color: '#00fbcd', margin: '0 0 15px 0' }}>Doctor Connection</h2>
          
          {connectedDoctor ? (
            <div style={{ width: '100%' }}>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '15px' }}>
                You are connected to:
              </p>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '15px',
                backgroundColor: 'rgba(0, 251, 205, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(0, 251, 205, 0.3)',
                marginBottom: '20px'
              }}>
                <div>
                  <h3 style={{ color: '#00fbcd', margin: '0 0 5px 0' }}>
                    Dr. {connectedDoctor.first_name} {connectedDoctor.last_name}
                  </h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 5px 0' }}>
                    {connectedDoctor.specialization || 'General Practice'}
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: 0, fontSize: '14px' }}>
                    {connectedDoctor.email}
                  </p>
                </div>
              </div>
              <button 
                onClick={openDoctorModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(0, 251, 205, 0.1)',
                  color: '#00fbcd',
                  border: '1px solid rgba(0, 251, 205, 0.3)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Find Other Available Doctors
              </button>
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '15px' }}>
                You are not connected to any doctor. Connect with a doctor to share your health data and receive professional care.
              </p>
              <button 
                onClick={openDoctorModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(0, 251, 205, 0.1)',
                  color: '#00fbcd',
                  border: '1px solid rgba(0, 251, 205, 0.3)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Connect to Doctor
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logout button */}
      <button 
        onClick={handleLogout}
        style={{
          position: 'fixed',
          top: '100px',
          right: '30px',
          padding: '12px 24px',
          backgroundColor: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '14px',
          zIndex: 1000
        }}
      >
        Logout
      </button>

      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '15px 20px',
          backgroundColor: notification.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white',
          borderRadius: '8px',
          zIndex: 1001,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{notification.message}</span>
            <button 
              onClick={closeNotification}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                marginLeft: '10px'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Doctor Selection Modal */}
      {showDoctorModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '25px',
            padding: '30px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#00fbcd', margin: 0 }}>Available Doctors</h2>
              <button 
                onClick={() => setShowDoctorModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {loadingDoctors ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.6)' }}>
                Loading doctors...
              </div>
            ) : doctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.6)' }}>
                No doctors available at the moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {doctors.map((doctor) => (
                  <div key={doctor.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ color: '#00fbcd', margin: '0 0 8px 0' }}>
                        Dr. {doctor.first_name} {doctor.last_name}
                      </h3>
                      <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 5px 0' }}>
                        {doctor.specialization || 'General Practice'}
                      </p>
                      <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: 0, fontSize: '14px' }}>
                        {doctor.email}
                      </p>
                      {doctor.license_no && (
                        <p style={{ color: 'rgba(255, 255, 255, 0.5)', margin: '5px 0 0 0', fontSize: '12px' }}>
                          License: {doctor.license_no}
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleConnectToDoctor(doctor.user_id)}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        marginLeft: '20px'
                      }}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings