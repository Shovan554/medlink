import { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    let interval;
    
    if (selectedConversation) {
      fetchMessages(selectedConversation.user_id);
      
      // Set up polling to refresh messages every 3 seconds
      interval = setInterval(() => {
        fetchMessages(selectedConversation.user_id);
      }, 3000);
    }
    
    // Cleanup interval when conversation changes or component unmounts
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:3001/api/conversations');
      
      if (response && response.ok) {
        const data = await response.json();
        console.log('Doctor conversations data:', data);
        
        // Sort conversations by last message time (most recent first)
        const sortedConversations = data.sort((a, b) => {
          const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
          const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
          return timeB - timeA;
        });
        
        setConversations(sortedConversations);
        if (sortedConversations.length > 0 && !selectedConversation) {
          setSelectedConversation(sortedConversations[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await authenticatedFetch(`http://localhost:3001/api/messages/${userId}`);
      
      if (response && response.ok) {
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
      const response = await authenticatedFetch('http://localhost:3001/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          content: messageContent,
          receiver_id: selectedConversation.user_id
        }),
      });

      if (response && response.ok) {
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

  const startCall = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:3001/api/calls/start', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: selectedConversation.user_id
        }),
      });

      if (response && response.ok) {
        const data = await response.json();
        setCallStatus(data);
        console.log('Call started:', data);
      }
    } catch (error) {
      console.error('Error starting call:', error);
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
          Patient Messages
        </h1>
        <p style={{ 
          margin: 0, 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '1.1rem' 
        }}>
          Communicate with your patients
        </p>
      </div>
      
      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
      }}>
        {/* Conversations Sidebar */}
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
            <h3 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px' }}>Patient Conversations</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ 
                padding: '40px 20px', 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.6)' 
              }}>
                No patient conversations yet
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
                        {conversation.first_name} {conversation.last_name}
                      </h4>
                      <p style={{ 
                        margin: 0, 
                        color: 'rgba(255, 255, 255, 0.6)', 
                        fontSize: '12px' 
                      }}>
                        Patient
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
                  {conversation.unread_count > 0 && (
                    <div style={{
                      position: 'absolute',
                      right: '15px',
                      top: '15px',
                      backgroundColor: '#ff6b6b',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {conversation.unread_count}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
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
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: 0, 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '18px' 
                    }}>
                      {selectedConversation.first_name} {selectedConversation.last_name}
                    </h3>
                    <p style={{ 
                      margin: 0, 
                      color: 'rgba(255, 255, 255, 0.6)', 
                      fontSize: '14px' 
                    }}>
                      Patient
                    </p>
                  </div>
                  <button
                    onClick={startCall}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'rgba(34, 197, 94, 0.8)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    📞 Start Call
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
                    No messages yet. Start a conversation with your patient!
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
                    placeholder="Type your message to patient..."
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
              Select a patient conversation to start messaging
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;
