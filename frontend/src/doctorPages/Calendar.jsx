import React, { useState, useEffect } from 'react';

function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'

  useEffect(() => {
    fetchAppointments();
  }, [currentDate, viewMode]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/appointments/doctor', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const formatDateForComparison = (date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  const getAppointmentsForDate = (date) => {
    const dateStr = formatDateForComparison(date);
    return appointments.filter(apt => 
      formatDateForComparison(apt.appointment_date) === dateStr
    );
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAppointmentTypeColor = (type) => {
    return type === 'virtual' ? '#3b82f6' : '#10b981';
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Days of week header */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{
            padding: '16px 8px',
            backgroundColor: 'rgba(0, 251, 205, 0.1)',
            color: '#00fbcd',
            textAlign: 'center',
            fontWeight: '600',
            fontSize: '14px'
          }}>
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((date, index) => {
          if (!date) {
            return <div key={index} style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              minHeight: '100px'
            }} />;
          }

          const isToday = formatDateForComparison(date) === formatDateForComparison(today);
          const dayAppointments = getAppointmentsForDate(date);

          return (
            <div key={index} style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              minHeight: '100px',
              padding: '8px',
              position: 'relative',
              border: isToday ? '2px solid #00fbcd' : 'none'
            }}>
              <div style={{
                color: isToday ? '#00fbcd' : 'rgba(255, 255, 255, 0.9)',
                fontWeight: isToday ? '600' : '500',
                fontSize: '14px',
                marginBottom: '4px'
              }}>
                {date.getDate()}
              </div>
              
              {/* Appointments for this day */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {dayAppointments.slice(0, 3).map((apt, aptIndex) => (
                  <div
                    key={apt.appointment_id}
                    onClick={() => setSelectedAppointment(apt)}
                    style={{
                      backgroundColor: getAppointmentTypeColor(apt.appointment_type),
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {formatTime(apt.start_time)} - {apt.first_name} {apt.last_name}
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '10px',
                    textAlign: 'center'
                  }}>
                    +{dayAppointments.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{
      padding: '30px',
      minHeight: '100vh',
      backgroundColor: 'transparent'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <button
          onClick={() => navigateDate(-1)}
          style={{
            backgroundColor: 'rgba(0, 251, 205, 0.1)',
            border: '1px solid rgba(0, 251, 205, 0.3)',
            borderRadius: '12px',
            color: '#00fbcd',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          ← Previous
        </button>

        <h2 style={{
          color: 'rgba(255, 255, 255, 0.9)',
          margin: 0,
          fontSize: '24px',
          fontWeight: '600'
        }}>
          {currentDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          })}
        </h2>

        <button
          onClick={() => navigateDate(1)}
          style={{
            backgroundColor: 'rgba(0, 251, 205, 0.1)',
            border: '1px solid rgba(0, 251, 205, 0.3)',
            borderRadius: '12px',
            color: '#00fbcd',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Next →
        </button>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(0, 251, 205, 0.3)',
            borderTop: '3px solid #00fbcd',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          Loading appointments...
        </div>
      ) : (
        <div style={{ width: '80%', margin: '0 auto', maxWidth: '1200px', minWidth: '800px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            backgroundColor: 'transparent',
            borderRadius: '12px',
            overflow: 'hidden',
            width: '100%',
            height: '600px'
          }}>
            {/* Days of week header */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{
                padding: '16px 8px',
                backgroundColor: 'rgba(0, 251, 205, 0.1)',
                color: '#00fbcd',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {getDaysInMonth(currentDate).map((date, index) => {
              if (!date) {
                return <div key={index} style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.02)'
                }} />;
              }

              const isToday = formatDateForComparison(date) === formatDateForComparison(new Date());
              const dayAppointments = getAppointmentsForDate(date);

              return (
                <div key={index} style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '8px',
                  position: 'relative',
                  border: isToday ? '2px solid #00fbcd' : 'none',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{
                    color: isToday ? '#00fbcd' : 'rgba(255, 255, 255, 0.9)',
                    fontWeight: isToday ? '600' : '500',
                    fontSize: '16px',
                    marginBottom: '4px'
                  }}>
                    {date.getDate()}
                  </div>
                  
                  {/* Appointments for this day */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    {dayAppointments.slice(0, 3).map((apt, aptIndex) => (
                      <div
                        key={apt.appointment_id}
                        onClick={() => setSelectedAppointment(apt)}
                        style={{
                          backgroundColor: getAppointmentTypeColor(apt.appointment_type),
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {formatTime(apt.start_time)} - {apt.first_name} {apt.last_name}
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '10px',
                        textAlign: 'center'
                      }}>
                        +{dayAppointments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
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
            background: 'rgba(26, 26, 26, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{
                color: '#00fbcd',
                margin: 0,
                fontSize: '20px'
              }}>
                Appointment Details
              </h3>
              <button
                onClick={() => setSelectedAppointment(null)}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Patient</label>
                <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px', fontWeight: '500' }}>
                  {selectedAppointment.first_name} {selectedAppointment.last_name}
                </div>
              </div>

              <div>
                <label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Date & Time</label>
                <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px' }}>
                  {new Date(selectedAppointment.appointment_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} at {formatTime(selectedAppointment.start_time)} - {formatTime(selectedAppointment.end_time)}
                </div>
              </div>

              <div>
                <label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Type</label>
                <div style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  backgroundColor: getAppointmentTypeColor(selectedAppointment.appointment_type),
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '14px',
                  textTransform: 'capitalize'
                }}>
                  {selectedAppointment.appointment_type}
                </div>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Notes</label>
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '12px',
                    borderRadius: '8px'
                  }}>
                    {selectedAppointment.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Calendar;
