import { useState, useEffect, useRef } from 'react';
import './Dashboard.css'
import { authenticatedFetch } from '../utils/auth'

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentType, setAppointmentType] = useState('');
  const [doctorAvailability, setDoctorAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [notification, setNotification] = useState(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthAvailability, setMonthAvailability] = useState({});

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

  const formatDateForInput = (date) => {
    return date.toISOString().split('T')[0];
  };

  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      
      // Fetch availability for the new month
      if (selectedConversation) {
        fetchMonthAvailability(
          selectedConversation.user_id, 
          newMonth.getMonth(), 
          newMonth.getFullYear()
        );
      }
      
      return newMonth;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.user_id);
      
      // Set up polling to refresh messages every 3 seconds
      const interval = setInterval(() => {
        fetchMessages(selectedConversation.user_id);
      }, 3000);
      
      // Cleanup interval when conversation changes or component unmounts
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
          try {
            const response = await authenticatedFetch('http://localhost:3001/api/conversations')
            
            if (response && response.ok) {
              const data = await response.json()
              setConversations(data)
            }
          } catch (error) {
            console.error('Error fetching conversations:', error)
          } finally {
            setLoading(false)
          }
   
  
  
 }

  const fetchMessages = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/messages/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const messageContent = newMessage;
    const userID = localStorage.getItem('userID');
    
    // Optimistic update - add message immediately to UI
    const tempMessage = {
      message_id: Date.now(), // temporary ID
      content: messageContent,
      sender_id: parseInt(userID),
      receiver_id: selectedConversation.user_id,
      created_at: new Date().toISOString(),
      sending: true // flag to show it's being sent
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: messageContent,
          receiver_id: selectedConversation.user_id
        }),
      });

      if (response.ok) {
        // Refresh messages to get the real message from server
        fetchMessages(selectedConversation.user_id);
        fetchConversations();
      } else {
        // Remove the optimistic message if sending failed
        setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
        setNewMessage(messageContent); // Restore the message text
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove the optimistic message if sending failed
      setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
      setNewMessage(messageContent); // Restore the message text
    }
  };

  const fetchDoctorAvailability = async (doctorId, date) => {
    setLoadingAvailability(true);
    try {
      const response = await fetch(`http://localhost:3001/api/appointments/available-slots/${doctorId}/${date}`);
      
      if (response.ok) {
        const data = await response.json();
        setDoctorAvailability(data);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const bookAppointment = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor_id: selectedConversation.user_id,
          appointment_date: selectedDate,
          start_time: selectedTime,
          end_time: calculateEndTime(selectedTime),
          notes: appointmentNotes,
          appointment_type: appointmentType
        })
      });

      if (response.ok) {
        showNotification('Appointment booked successfully!', 'success');
        setShowAppointmentModal(false);
        resetAppointmentForm();
      } else {
        showNotification('Failed to book appointment', 'error');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      showNotification('Error booking appointment', 'error');
    }
  };

  const calculateEndTime = (startTime) => {
    const [hours, minutes] = startTime.split(':');
    const endHour = parseInt(hours) + 1;
    return `${endHour.toString().padStart(2, '0')}:${minutes}`;
  };

  const resetAppointmentForm = () => {
    setAppointmentType('');
    setSelectedDate('');
    setSelectedTime('');
    setAppointmentNotes('');
    setDoctorAvailability([]);
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(closeNotification, 3000);
  };

  const closeNotification = () => {
    setNotification(null);
  };

  const fetchMonthAvailability = async (doctorId, month, year) => {
    try {
      const token = localStorage.getItem('token');
      // Fetch the doctor's weekly availability pattern
      const response = await fetch(`http://localhost:3001/api/appointments/doctor-availability/${doctorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const availability = await response.json();
        
        // Create a map of day_of_week to availability
        const availabilityMap = {};
        availability.forEach(slot => {
          availabilityMap[slot.day_of_week] = true;
        });
        
        // Generate availability for the entire month based on weekly pattern
        const monthAvail = {};
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          const dayOfWeek = date.getDay();
          const dateStr = formatDateForInput(date);
          
          // Show green if doctor has availability on this day of week
          monthAvail[dateStr] = availabilityMap[dayOfWeek] || false;
        }
        
        setMonthAvailability(monthAvail);
      }
    } catch (error) {
      console.error('Error fetching month availability:', error);
      // Fallback: assume availability on weekdays if API fails
      const monthAvail = {};
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const dateStr = formatDateForInput(date);
        
        // Show green for weekdays (Mon-Fri) as fallback
        monthAvail[dateStr] = dayOfWeek >= 1 && dayOfWeek <= 5;
      }
      
      setMonthAvailability(monthAvail);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 'calc(100vh - 80px)',
        width: '100%'
      }}>
        <div className="loading-spinner"></div>
        <p style={{ marginLeft: '10px', color: 'rgba(255, 255, 255, 0.8)' }}>Loading messages...</p>
      </div>
    );
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
          Messages
        </h1>
        <p style={{ 
          margin: 0, 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '1.1rem' 
        }}>
          Chat with your healthcare providers
        </p>
      </div>
      
      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
      }}>
        {/* Conversations Sidebar - 30% */}
        <div style={{ 
          width: '30%', 
          borderRight: '1px solid rgba(255, 255, 255, 0.1)', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{ 
            padding: '20px', 
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            flexShrink: 0
          }}>
            <h3 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px' }}>Conversations</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ 
                padding: '40px 20px', 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.6)' 
              }}>
                No conversations yet
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.user_id}
                  onClick={() => setSelectedConversation(conversation)}
                  style={{
                    padding: '15px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    backgroundColor: selectedConversation?.user_id === conversation.user_id 
                      ? 'rgba(0, 251, 205, 0.1)' 
                      : 'transparent',
                    borderLeft: selectedConversation?.user_id === conversation.user_id 
                      ? '3px solid #00fbcd' 
                      : '3px solid transparent',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedConversation?.user_id !== conversation.user_id) {
                      e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedConversation?.user_id !== conversation.user_id) {
                      e.target.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#00fbcd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      color: '#1a1a1a',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}>
                      {conversation.first_name?.[0]}{conversation.last_name?.[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ 
                        margin: 0, 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        Dr. {conversation.first_name} {conversation.last_name}
                      </h4>
                      <p style={{ 
                        margin: 0, 
                        color: 'rgba(255, 255, 255, 0.6)', 
                        fontSize: '12px' 
                      }}>
                        {conversation.specialization}
                      </p>
                    </div>
                  </div>
                  {conversation.last_message && (
                    <p style={{ 
                      margin: 0, 
                      color: 'rgba(255, 255, 255, 0.7)', 
                      fontSize: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conversation.last_message}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area - 70% */}
        <div style={{ width: '70%', display: 'flex', flexDirection: 'column' }}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div style={{ 
                padding: '20px', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: '45px',
                      height: '45px',
                      borderRadius: '50%',
                      backgroundColor: '#00fbcd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '15px',
                      color: '#1a1a1a',
                      fontWeight: '600',
                      fontSize: '18px'
                    }}>
                      {selectedConversation.first_name?.[0]}{selectedConversation.last_name?.[0]}
                    </div>
                    <div>
                      <h3 style={{ 
                        margin: 0, 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '18px' 
                      }}>
                        Dr. {selectedConversation.first_name} {selectedConversation.last_name}
                      </h3>
                      <p style={{ 
                        margin: 0, 
                        color: 'rgba(255, 255, 255, 0.6)', 
                        fontSize: '14px' 
                      }}>
                        Doctor
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowAppointmentModal(true)}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#00fbcd',
                      color: '#1a1a1a',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Set up Appointment
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px' 
              }}>
                {messages.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    padding: '40px' 
                  }}>
                    No messages yet. Start a conversation!
                  </div>
                ) : (
                  messages.map((message) => {
                    const userID = localStorage.getItem('userID');
                    const isMyMessage = message.sender_id == userID;
                    
                    return (
                      <div
                        key={message.message_id}
                        style={{
                          display: 'flex',
                          justifyContent: isMyMessage ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '70%',
                            padding: '12px 16px',
                            borderRadius: '18px',
                            backgroundColor: isMyMessage ? '#00fbcd' : 'rgba(255, 255, 255, 0.1)',
                            color: isMyMessage ? '#1a1a1a' : 'rgba(255, 255, 255, 0.9)',
                            border: isMyMessage ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>{message.content}</p>
                          <p style={{
                            margin: 0,
                            fontSize: '11px',
                            opacity: 0.7,
                            textAlign: 'right'
                          }}>
                            {new Date(message.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div style={{ 
                borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                padding: '20px',
                flexShrink: 0
              }}>
                <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '25px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '25px',
                      border: 'none',
                      backgroundColor: '#00fbcd',
                      color: '#1a1a1a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: newMessage.trim() ? 1 : 0.5,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>

      {/* Appointment Booking Modal */}
      {showAppointmentModal && (
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
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#00fbcd', margin: 0 }}>Book Appointment</h2>
              <button 
                onClick={() => {
                  setShowAppointmentModal(false);
                  resetAppointmentForm();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {!appointmentType ? (
              <div>
                <h3 style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '20px' }}>
                  Choose Appointment Type
                </h3>
                <div style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
                  <button
                    onClick={() => setAppointmentType('virtual')}
                    style={{
                      padding: '20px',
                      backgroundColor: 'rgba(0, 251, 205, 0.1)',
                      color: '#00fbcd',
                      border: '1px solid rgba(0, 251, 205, 0.3)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ marginBottom: '5px' }}>🖥️ Virtual Appointment</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                      Video call consultation from home
                    </div>
                  </button>
                  <button
                    onClick={() => setAppointmentType('general')}
                    style={{
                      padding: '20px',
                      backgroundColor: 'rgba(0, 251, 205, 0.1)',
                      color: '#00fbcd',
                      border: '1px solid rgba(0, 251, 205, 0.3)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ marginBottom: '5px' }}>🏥 In-Person Appointment</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                      Visit the clinic for consultation
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <button
                    onClick={() => {
                      setAppointmentType('');
                      resetAppointmentForm();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#00fbcd',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ← Back to appointment types
                  </button>
                </div>

                <h3 style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '20px' }}>
                  Select Date & Time - {appointmentType === 'virtual' ? 'Virtual' : 'In-Person'}
                </h3>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: 'rgba(255, 255, 255, 0.9)', display: 'block', marginBottom: '8px' }}>
                    Select Date:
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : ''}
                      placeholder="Click to select a date"
                      readOnly
                      onClick={() => {
                        setShowCalendar(!showCalendar);
                        if (!showCalendar && selectedConversation) {
                          // Fetch availability for current month when opening calendar
                          fetchMonthAvailability(
                            selectedConversation.user_id,
                            currentMonth.getMonth(),
                            currentMonth.getFullYear()
                          );
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    />
                    
                    {showCalendar && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '0',
                        right: '0',
                        backgroundColor: 'rgba(26, 26, 26, 0.98)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(0, 251, 205, 0.3)',
                        borderRadius: '16px',
                        padding: '20px',
                        zIndex: 1000,
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                        marginTop: '8px'
                      }}>
                        {/* Calendar Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '20px'
                        }}>
                          <button
                            onClick={() => navigateMonth(-1)}
                            style={{
                              background: 'rgba(0, 251, 205, 0.1)',
                              border: '1px solid rgba(0, 251, 205, 0.3)',
                              borderRadius: '8px',
                              color: '#00fbcd',
                              width: '36px',
                              height: '36px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px'
                            }}
                          >
                            ‹
                          </button>
                          
                          <h3 style={{
                            color: '#00fbcd',
                            margin: 0,
                            fontSize: '18px',
                            fontWeight: '600'
                          }}>
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </h3>
                          
                          <button
                            onClick={() => navigateMonth(1)}
                            style={{
                              background: 'rgba(0, 251, 205, 0.1)',
                              border: '1px solid rgba(0, 251, 205, 0.3)',
                              borderRadius: '8px',
                              color: '#00fbcd',
                              width: '36px',
                              height: '36px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px'
                            }}
                          >
                            ›
                          </button>
                        </div>
                        
                        {/* Days of Week Header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, 1fr)',
                          gap: '4px',
                          marginBottom: '12px'
                        }}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} style={{
                              textAlign: 'center',
                              color: 'rgba(255, 255, 255, 0.6)',
                              fontSize: '12px',
                              fontWeight: '600',
                              padding: '8px 4px'
                            }}>
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar Days */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, 1fr)',
                          gap: '4px'
                        }}>
                          {getDaysInMonth(currentMonth).map((date, index) => {
                            if (!date) {
                              return <div key={index} style={{ height: '40px' }} />;
                            }
                            
                            const isDisabled = isDateDisabled(date);
                            const isSelected = selectedDate === formatDateForInput(date);
                            const isToday = formatDateForInput(date) === formatDateForInput(new Date());
                            const hasAvailability = monthAvailability[formatDateForInput(date)];
                            
                            return (
                              <button
                                key={index}
                                onClick={() => {
                                  if (!isDisabled) {
                                    setSelectedDate(formatDateForInput(date));
                                    setShowCalendar(false);
                                    fetchDoctorAvailability(selectedConversation.user_id, formatDateForInput(date));
                                  }
                                }}
                                disabled={isDisabled}
                                style={{
                                  height: '40px',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  position: 'relative',
                                  backgroundColor: isSelected 
                                    ? '#00fbcd' 
                                    : isToday 
                                      ? 'rgba(0, 251, 205, 0.2)'
                                      : isDisabled 
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : hasAvailability
                                          ? 'rgba(34, 197, 94, 0.2)'
                                          : 'rgba(255, 255, 255, 0.1)',
                                  color: isSelected 
                                    ? '#1a1a1a' 
                                    : isDisabled 
                                      ? 'rgba(255, 255, 255, 0.3)'
                                      : isToday
                                        ? '#00fbcd'
                                        : hasAvailability
                                          ? '#22c55e'
                                          : 'rgba(255, 255, 255, 0.9)',
                                  border: isToday && !isSelected 
                                    ? '1px solid rgba(0, 251, 205, 0.5)' 
                                    : hasAvailability && !isSelected && !isToday
                                      ? '1px solid rgba(34, 197, 94, 0.4)'
                                      : 'none',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDisabled && !isSelected) {
                                    e.target.style.backgroundColor = hasAvailability 
                                      ? 'rgba(34, 197, 94, 0.3)' 
                                      : 'rgba(0, 251, 205, 0.15)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isDisabled && !isSelected) {
                                    e.target.style.backgroundColor = isToday 
                                      ? 'rgba(0, 251, 205, 0.2)' 
                                      : hasAvailability
                                        ? 'rgba(34, 197, 94, 0.2)'
                                        : 'rgba(255, 255, 255, 0.1)';
                                  }
                                }}
                              >
                                {date.getDate()}
                                {hasAvailability && !isSelected && (
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    right: '2px',
                                    width: '6px',
                                    height: '6px',
                                    backgroundColor: '#22c55e',
                                    borderRadius: '50%'
                                  }} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {loadingAvailability ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="loading-spinner"></div>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Loading availability...</p>
                  </div>
                ) : selectedDate && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ color: 'rgba(255, 255, 255, 0.9)', display: 'block', marginBottom: '8px' }}>
                      Available Times:
                    </label>
                    {doctorAvailability.length === 0 ? (
                      <p style={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', padding: '20px' }}>
                        No available slots for this date. Please select another date.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                        {doctorAvailability.map((slot, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedTime(slot.start_time)}
                            style={{
                              padding: '10px',
                              backgroundColor: selectedTime === slot.start_time 
                                ? '#00fbcd' 
                                : 'rgba(255, 255, 255, 0.1)',
                              color: selectedTime === slot.start_time 
                                ? '#1a1a1a' 
                                : 'rgba(255, 255, 255, 0.9)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            {slot.start_time} - {slot.end_time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: 'rgba(255, 255, 255, 0.9)', display: 'block', marginBottom: '8px' }}>
                    Notes (optional):
                  </label>
                  <textarea
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    placeholder="Any specific concerns or notes for the doctor..."
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <button
                  onClick={bookAppointment}
                  disabled={!selectedDate || !selectedTime}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: selectedDate && selectedTime ? '#00fbcd' : 'rgba(255, 255, 255, 0.3)',
                    color: selectedDate && selectedTime ? '#1a1a1a' : 'rgba(255, 255, 255, 0.5)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: selectedDate && selectedTime ? 'pointer' : 'not-allowed',
                    fontWeight: '600',
                    fontSize: '16px'
                  }}
                >
                  Book Appointment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: notification.type === 'success' ? 'rgba(0, 251, 205, 0.95)' : 'rgba(255, 68, 68, 0.95)',
          color: notification.type === 'success' ? '#1a1a1a' : 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '300px',
          maxWidth: '400px'
        }}>
          <span style={{ flex: 1, fontWeight: '500' }}>{notification.message}</span>
          <button
            onClick={closeNotification}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default Messages;
