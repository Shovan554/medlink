import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

function Settings() {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    license_no: '',
    specialization: '',
    npi: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)
  const [availability, setAvailability] = useState([])
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false)
  const [newAvailability, setNewAvailability] = useState({
    day_of_week: '',
    start_time: '',
    end_time: ''
  })
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    fetchProfileData()
    fetchUserData()
    fetchAvailability()
  }, [])

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

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/doctors/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setProfileData({
          license_no: data.license_no || '',
          specialization: data.specialization || '',
          npi: data.npi || ''
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchAvailability = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/appointments/availability', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAvailability(data)
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    }
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
    setMessage('')
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/doctors/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      })

      if (response.ok) {
        setMessage('Profile updated successfully!')
        setIsEditing(false)
      } else {
        setMessage('Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage('Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAvailability = async (e) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/appointments/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAvailability)
      })

      if (response.ok) {
        setMessage('Availability added successfully!')
        setShowAvailabilityForm(false)
        setNewAvailability({ day_of_week: '', start_time: '', end_time: '' })
        fetchAvailability()
      } else {
        setMessage('Failed to add availability')
      }
    } catch (error) {
      console.error('Error adding availability:', error)
      setMessage('Error adding availability')
    }
  }

  const handleDeleteAvailability = async (id) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3001/api/appointments/availability/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setMessage('Availability deleted successfully!')
        fetchAvailability()
      } else {
        setMessage('Failed to delete availability')
      }
    } catch (error) {
      console.error('Error deleting availability:', error)
      setMessage('Error deleting availability')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    sessionStorage.removeItem('hasVisitedLoading')
    navigate('/login')
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
          Doctor Settings
        </h1>
        <p style={{ 
          margin: 0, 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '1.1rem' 
        }}>
          Manage your professional profile and credentials
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', width: '100%' }}>
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
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Email:</label>
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {user.email}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Professional Profile Section */}
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
            <h2 style={{ color: '#00fbcd', margin: 0 }}>Professional Profile</h2>
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

          {message && (
            <div style={{ 
              padding: '15px', 
              marginBottom: '25px', 
              backgroundColor: message.includes('success') ? 'rgba(0, 251, 205, 0.1)' : 'rgba(255, 68, 68, 0.1)',
              color: message.includes('success') ? '#00fbcd' : '#ff4444',
              borderRadius: '10px',
              border: `1px solid ${message.includes('success') ? 'rgba(0, 251, 205, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
              width: '100%'
            }}>
              {message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', width: '100%' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>License Number:</label>
              {isEditing ? (
                <input
                  type="text"
                  name="license_no"
                  value={profileData.license_no}
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
                  placeholder="Enter medical license number"
                />
              ) : (
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {profileData.license_no || 'Not set'}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Specialization:</label>
              {isEditing ? (
                <input
                  type="text"
                  name="specialization"
                  value={profileData.specialization}
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
                  placeholder="e.g., Cardiology, Internal Medicine"
                />
              ) : (
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {profileData.specialization || 'Not set'}
                </span>
              )}
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>NPI Number:</label>
              {isEditing ? (
                <input
                  type="text"
                  name="npi"
                  value={profileData.npi}
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
                  placeholder="Enter NPI number (optional)"
                />
              ) : (
                <span style={{ color: '#00fbcd', fontSize: '16px', fontWeight: '500' }}>
                  {profileData.npi || 'Not set'}
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

        {/* Availability Management Section */}
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
            <h2 style={{ color: '#00fbcd', margin: 0 }}>Weekly Availability Schedule</h2>
            <button 
              onClick={() => setShowAvailabilityForm(!showAvailabilityForm)}
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
              {showAvailabilityForm ? 'Cancel' : 'Add Availability'}
            </button>
          </div>

          {showAvailabilityForm && (
            <form onSubmit={handleAddAvailability} style={{ width: '100%', marginBottom: '25px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '20px', alignItems: 'end' }}>
                <div>
                  <label style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                    Day of Week
                  </label>
                  <select
                    value={newAvailability.day_of_week}
                    onChange={(e) => setNewAvailability(prev => ({ ...prev, day_of_week: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select Day</option>
                    {dayNames.map((day, index) => (
                      <option key={index} value={index} style={{ backgroundColor: '#1a1a1a' }}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newAvailability.start_time}
                    onChange={(e) => setNewAvailability(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newAvailability.end_time}
                    onChange={(e) => setNewAvailability(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  Add
                </button>
              </div>
            </form>
          )}

          <div style={{ width: '100%' }}>
            <h3 style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '20px', fontSize: '18px' }}>Current Weekly Schedule</h3>
            {availability.length === 0 ? (
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '16px', textAlign: 'center', padding: '20px' }}>
                No weekly schedule set. Add your regular availability above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {availability.map((slot) => (
                  <div key={slot.availability_id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                  }}>
                    <div>
                      <span style={{ 
                        color: '#00fbcd', 
                        fontWeight: '600', 
                        fontSize: '16px',
                        marginRight: '20px'
                      }}>
                        {slot.day_name}
                      </span>
                      <span style={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '15px',
                        fontWeight: '500'
                      }}>
                        {formatTime12Hour(slot.start_time)} - {formatTime12Hour(slot.end_time)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteAvailability(slot.availability_id)}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
    </div>
  )
}

export default Settings
