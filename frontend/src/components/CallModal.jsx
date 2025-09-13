import React from 'react';

const CallModal = ({ 
  isVisible, 
  isIncoming, 
  caller, 
  onAccept, 
  onReject, 
  onEndCall,
  callStatus 
}) => {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'rgba(26, 26, 26, 0.95)',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minWidth: '400px'
      }}>
        {isIncoming ? (
          <>
            <h2 style={{ color: '#00fbcd', marginBottom: '20px' }}>
              Incoming Call
            </h2>
            <p style={{ color: 'white', fontSize: '18px', marginBottom: '30px' }}>
              {caller?.first_name} {caller?.last_name} is calling...
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <button
                onClick={onAccept}
                style={{
                  padding: '15px 30px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                📞 Accept
              </button>
              <button
                onClick={onReject}
                style={{
                  padding: '15px 30px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                📞 Decline
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: '#00fbcd', marginBottom: '20px' }}>
              {callStatus === 'ongoing' ? 'Call Connected' : 'Calling...'}
            </h2>
            <p style={{ color: 'white', fontSize: '18px', marginBottom: '30px' }}>
              {callStatus === 'ongoing' ? 'Call in progress' : 'Waiting for response...'}
            </p>
            <button
              onClick={onEndCall}
              style={{
                padding: '15px 30px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              📞 End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CallModal;