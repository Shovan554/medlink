import { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState(null);
  const [isAiChat, setIsAiChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const formatAiResponse = (content) => {
    // Split the content into sections
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        // Bold headers
        return <strong key={index}>{line.slice(2, -2)}</strong>;
      } else if (line.startsWith('- ')) {
        // Bullet points
        return <li key={index}>{line.slice(2)}</li>;
      } else {
        // Regular text
        return <p key={index}>{line}</p>;
      }
    });
  };

  const formatClinicalNote = (content) => {
    // Split content into sections
    const sections = content.split('\n\n').filter(section => section.trim());
    
    return sections.map((section, index) => {
      const trimmedSection = section.trim();
      
      if (trimmedSection.startsWith('Assessment:')) {
        return (
          <div key={index} style={{ marginBottom: '15px' }}>
            <div style={{ 
              color: '#4f46e5', 
              fontWeight: '700', 
              fontSize: '15px',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              📊 ASSESSMENT
            </div>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '500',
              lineHeight: '1.5',
              paddingLeft: '10px',
              borderLeft: '3px solid #4f46e5'
            }}>
              {trimmedSection.replace('Assessment:', '').trim()}
            </div>
          </div>
        );
      } else if (trimmedSection.startsWith('Key Data:')) {
        return (
          <div key={index} style={{ marginBottom: '15px' }}>
            <div style={{ 
              color: '#00fbcd', 
              fontWeight: '700', 
              fontSize: '15px',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              📈 KEY DATA
            </div>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.6',
              paddingLeft: '10px',
              borderLeft: '3px solid #00fbcd',
              fontFamily: 'monospace',
              fontSize: '13px'
            }}>
              {trimmedSection.replace('Key Data:', '').trim()}
            </div>
          </div>
        );
      } else if (trimmedSection.startsWith('Recommendations:')) {
        return (
          <div key={index} style={{ marginBottom: '15px' }}>
            <div style={{ 
              color: '#fbbf24', 
              fontWeight: '700', 
              fontSize: '15px',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              💡 RECOMMENDATIONS
            </div>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.6',
              paddingLeft: '10px',
              borderLeft: '3px solid #fbbf24'
            }}>
              {trimmedSection.replace('Recommendations:', '').trim()}
            </div>
          </div>
        );
      } else if (trimmedSection.startsWith('Medication considerations')) {
        return (
          <div key={index} style={{ marginBottom: '15px' }}>
            <div style={{ 
              color: '#f87171', 
              fontWeight: '700', 
              fontSize: '15px',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              💊 MEDICATION CONSIDERATIONS
            </div>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.6',
              paddingLeft: '10px',
              borderLeft: '3px solid #f87171',
              fontStyle: 'italic'
            }}>
              {trimmedSection.replace('Medication considerations (clinician judgment only):', '').trim()}
            </div>
          </div>
        );
      } else {
        return (
          <div key={index} style={{ 
            marginBottom: '10px',
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: '1.6'
          }}>
            {trimmedSection}
          </div>
        );
      }
    });
  };

  useEffect(() => {
    fetchConversations();
    fetchAiConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      if (selectedConversation.user_id === -1) {
        // AI conversation selected
        setIsAiChat(true);
        setMessages(aiMessages);
      } else {
        // Regular patient conversation
        setIsAiChat(false);
        fetchMessages(selectedConversation.user_id);
        
        // Set up polling for regular messages
        const interval = setInterval(() => {
          fetchMessages(selectedConversation.user_id);
        }, 3000);
        
        return () => clearInterval(interval);
      }
    }
  }, [selectedConversation, aiMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping]);

  const fetchConversations = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:3001/api/messages/conversations');
      
      if (response && response.ok) {
        const data = await response.json();
        
        // Add Medlink Assistant as first conversation
        const aiConversation = {
          user_id: -1,
          first_name: 'Medlink',
          last_name: 'Assistant',
          specialization: 'AI Clinical Assistant',
          last_message: 'Ask me about patient health data',
          last_message_time: new Date().toISOString(),
          unread_count: 0
        };
        
        // Sort conversations by last message time (most recent first)
        const sortedConversations = data.sort((a, b) => {
          const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
          const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
          return timeB - timeA;
        });
        
        setConversations([aiConversation, ...sortedConversations]);
        if (!selectedConversation) {
          // Auto-select most recent patient conversation instead of AI
          const mostRecentPatient = sortedConversations[0];
          setSelectedConversation(mostRecentPatient || aiConversation);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiConversations = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:3001/api/doctor/ai/conversations')
      
      if (response && response.ok) {
        const data = await response.json()
        console.log('AI conversations data:', data) // Debug log
        setAiMessages(data)
      }
    } catch (error) {
      console.error('Error fetching AI conversations:', error)
    }
  }

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
    if ((!newMessage.trim() && !selectedFile) || !selectedConversation) return;

    const messageContent = newMessage || (selectedFile ? `📎 ${selectedFile.name}` : '');
    const userID = localStorage.getItem('userID');
    
    if (isAiChat) {
      // Handle AI chat with file attachments
      const tempMessage = {
        message_id: Date.now(),
        content: messageContent,
        sender_id: parseInt(userID),
        receiver_id: -1,
        created_at: new Date().toISOString(),
        sending: true,
        file_url: selectedFile ? URL.createObjectURL(selectedFile) : null,
        file_type: selectedFile?.type,
        file_size: selectedFile?.size
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      const fileToSend = selectedFile;
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('file-upload');
      if (fileInput) fileInput.value = '';
      
      setIsAiTyping(true);

      try {
        let response;
        
        if (fileToSend) {
          // Send file to AI with FormData
          const formData = new FormData();
          formData.append('message', messageContent);
          formData.append('attachment', fileToSend);

          response = await fetch('http://localhost:3001/api/doctor/ai/chat-with-file', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
          });
        } else {
          // Regular AI chat
          response = await authenticatedFetch('http://localhost:3001/api/doctor/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ message: messageContent }),
          });
        }

        if (response && response.ok) {
          const data = await response.json();
          
          const aiResponse = {
            message_id: Date.now() + 1,
            content: data.response,
            sender_id: -1,
            receiver_id: parseInt(userID),
            created_at: new Date().toISOString()
          };
          
          setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
          setIsAiTyping(false);
          fetchAiConversations(); // This should now include the attachment
        } else {
          setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
          setIsAiTyping(false);
          setNewMessage(messageContent);
          setSelectedFile(fileToSend);
        }
      } catch (error) {
        console.error('Error sending AI message:', error);
        setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
        setIsAiTyping(false);
        setNewMessage(messageContent);
        setSelectedFile(fileToSend);
      }
    } else {
      // Handle regular patient chat with attachments
      const tempMessage = {
        message_id: Date.now(),
        content: messageContent,
        sender_id: parseInt(userID),
        receiver_id: selectedConversation.user_id,
        created_at: new Date().toISOString(),
        sending: true,
        file_url: selectedFile ? URL.createObjectURL(selectedFile) : null,
        file_type: selectedFile?.type,
        file_size: selectedFile?.size
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      const fileToSend = selectedFile;
      setSelectedFile(null);

      try {
        let response;
        
        if (fileToSend) {
          // Send as FormData for file uploads
          const formData = new FormData();
          formData.append('content', messageContent);
          formData.append('receiver_id', selectedConversation.user_id);
          formData.append('attachment', fileToSend);

          response = await fetch('http://localhost:3001/api/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
          });
        } else {
          // Send as JSON for text-only messages
          response = await authenticatedFetch('http://localhost:3001/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: messageContent,
              receiver_id: selectedConversation.user_id
            })
          });
        }

        if (response && response.ok) {
          fetchMessages(selectedConversation.user_id);
          fetchConversations();
        } else {
          setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
          setNewMessage(messageContent);
          setSelectedFile(fileToSend);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
        setNewMessage(messageContent);
        setSelectedFile(fileToSend);
      }
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('File size must be less than 10MB');
        e.target.value = ''; // Reset input
        return;
      }
      setSelectedFile(file);
      console.log('File selected:', file.name, file.size); // Debug log
    }
    // Don't reset the input here - let it reset after sending
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
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
                      backgroundColor: conversation.user_id === -1 ? '#4f46e5' : '#00fbcd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      color: '#1a1a1a',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}>
                      {conversation.user_id === -1 ? '🤖' : `${conversation.first_name?.[0]}${conversation.last_name?.[0]}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ 
                        margin: 0, 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {conversation.user_id === -1 ? 'Medlink Assistant' : `${conversation.first_name} ${conversation.last_name}`}
                      </h4>
                      <p style={{ 
                        margin: 0, 
                        color: 'rgba(255, 255, 255, 0.6)', 
                        fontSize: '12px' 
                      }}>
                        {conversation.user_id === -1 ? 'AI Clinical Assistant' : 'Patient'}
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
                    backgroundColor: selectedConversation.user_id === -1 ? '#4f46e5' : '#00fbcd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '15px',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '18px'
                  }}>
                    {selectedConversation.user_id === -1 ? '🤖' : `${selectedConversation.first_name?.[0]}${selectedConversation.last_name?.[0]}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: 0, 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '18px' 
                    }}>
                      {selectedConversation.user_id === -1 ? 'Medlink Assistant' : `${selectedConversation.first_name} ${selectedConversation.last_name}`}
                    </h3>
                    <p style={{ 
                      margin: 0, 
                      color: 'rgba(255, 255, 255, 0.6)', 
                      fontSize: '14px' 
                    }}>
                      {selectedConversation.user_id === -1 ? 'AI Clinical Assistant' : 'Patient'}
                    </p>
                  </div>
                  {selectedConversation.user_id !== -1 && (
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
                  )}
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
                    {isAiChat ? 'Ask Medlink Assistant about patient health data!' : 'No messages yet. Start a conversation with your patient!'}
                  </div>
                ) : (
                  messages.map((message) => {
                    const userID = localStorage.getItem('userID');
                    const isMyMessage = message.sender_id == userID;
                    const isAiMessage = message.sender_id === -1;
                    
                    return (
                      <div
                        key={message.message_id}
                        style={{
                          display: 'flex',
                          justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                          alignItems: 'flex-start',
                          gap: '12px'
                        }}
                      >
                        {!isMyMessage && (
                          <div style={{
                            width: '35px',
                            height: '35px',
                            borderRadius: '50%',
                            backgroundColor: isAiMessage ? '#4f46e5' : '#00fbcd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px',
                            flexShrink: 0,
                            marginTop: '5px'
                          }}>
                            {isAiMessage ? '🤖' : selectedConversation?.first_name?.[0]}
                          </div>
                        )}
                        
                        <div
                          style={{
                            maxWidth: isAiMessage ? '90%' : '70%',
                            padding: isAiMessage ? '20px' : '12px 16px',
                            borderRadius: isAiMessage ? '12px' : '18px',
                            backgroundColor: isMyMessage ? '#00fbcd' : (isAiMessage ? 'rgba(79, 70, 229, 0.1)' : 'rgba(255, 255, 255, 0.1)'),
                            color: isMyMessage ? '#1a1a1a' : 'rgba(255, 255, 255, 0.9)',
                            border: isMyMessage ? 'none' : (isAiMessage ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)'),
                            position: 'relative',
                            textAlign: 'left'
                          }}
                        >
                          {isAiMessage ? (
                            <div style={{ 
                              fontSize: '14px',
                              lineHeight: '1.6',
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {formatClinicalNote(message.content)}
                            </div>
                          ) : (
                            <>
                              <p style={{ margin: '0 0 5px 0', fontSize: '14px', textAlign: 'left' }}>
                                {message.content}
                              </p>
                              {message.file_url && (
                                <div style={{ marginTop: '10px' }}>
                                  {message.file_type?.startsWith('image/') ? (
                                    <img 
                                      src={message.file_url.startsWith('blob:') ? message.file_url : `http://localhost:3001${message.file_url}`}
                                      alt="Attachment"
                                      style={{ 
                                        maxWidth: '200px', 
                                        maxHeight: '200px', 
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => {
                                        if (!message.file_url.startsWith('blob:')) {
                                          window.open(`http://localhost:3001${message.file_url}`, '_blank');
                                        }
                                      }}
                                    />
                                  ) : (
                                    <a 
                                      href={message.file_url.startsWith('blob:') ? '#' : `http://localhost:3001${message.file_url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '6px',
                                        color: isMyMessage ? '#1a1a1a' : '#00fbcd',
                                        textDecoration: 'none',
                                        fontSize: '12px'
                                      }}
                                    >
                                      📎 {message.file_url.startsWith('blob:') ? 'Uploading...' : message.file_url.split('/').pop()}
                                    </a>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          
                          <p style={{
                            margin: isAiMessage ? '15px 0 0 0' : '0',
                            fontSize: '11px',
                            opacity: 0.7,
                            textAlign: 'right',
                            borderTop: isAiMessage ? '1px solid rgba(79, 70, 229, 0.2)' : 'none',
                            paddingTop: isAiMessage ? '10px' : '0'
                          }}>
                            {new Date(message.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        
                        {isMyMessage && (
                          <div style={{
                            width: '35px',
                            height: '35px',
                            borderRadius: '50%',
                            backgroundColor: '#00fbcd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1a1a1a',
                            fontSize: '16px',
                            fontWeight: '600',
                            flexShrink: 0,
                            marginTop: '5px'
                          }}>
                            Dr
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                
                {/* AI Typing Indicator */}
                {isAiTyping && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '35px',
                      height: '35px',
                      borderRadius: '50%',
                      backgroundColor: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '16px',
                      flexShrink: 0,
                      marginTop: '5px'
                    }}>
                      🤖
                    </div>
                    
                    <div style={{
                      maxWidth: '85%',
                      padding: '20px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(79, 70, 229, 0.1)',
                      border: '1px solid rgba(79, 70, 229, 0.3)',
                      position: 'relative'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '12px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid rgba(79, 70, 229, 0.2)'
                      }}>
                        <span style={{
                          color: '#4f46e5',
                          fontWeight: '600',
                          fontSize: '14px'
                        }}>
                          Medlink Assistant - Analyzing...
                        </span>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}>
                        <div style={{
                          display: 'flex',
                          gap: '4px'
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#4f46e5',
                            animation: 'typing-dot 1.4s infinite ease-in-out',
                            animationDelay: '0s'
                          }}></div>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#4f46e5',
                            animation: 'typing-dot 1.4s infinite ease-in-out',
                            animationDelay: '0.2s'
                          }}></div>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#4f46e5',
                            animation: 'typing-dot 1.4s infinite ease-in-out',
                            animationDelay: '0.4s'
                          }}></div>
                        </div>
                        <span style={{ fontSize: '14px', fontStyle: 'italic' }}>
                          Processing clinical data...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div style={{ 
                borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                padding: '20px',
                flexShrink: 0
              }}>
                {selectedFile && (
                  <div style={{
                    marginBottom: '10px',
                    padding: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                      📎 {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      onClick={removeSelectedFile}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ff6b6b',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={isAiChat ? "Ask Medlink Assistant..." : "Type your message..."}
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
                  
                  {/* Show attachment button for BOTH AI chat and regular chat */}
                  <input
                    type="file"
                    id="file-upload"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <label
                    htmlFor="file-upload"
                    style={{
                      padding: '12px',
                      borderRadius: '50%',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}
                  >
                    📎
                  </label>
                  
                  <button
                    type="submit"
                    disabled={!newMessage.trim() && !selectedFile}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '25px',
                      border: 'none',
                      backgroundColor: '#00fbcd',
                      color: '#1a1a1a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: (newMessage.trim() || selectedFile) ? 1 : 0.5,
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
      {/* CSS for typing animation */}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          30% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default Messages;
