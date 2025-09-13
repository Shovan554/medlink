import React, { useState, useEffect } from 'react';
import './Alerts.css';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/alerts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      } else {
        console.error('Failed to fetch alerts');
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/alerts/${alertId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.alert_id === alertId ? { ...alert, is_read: true } : alert
        ));
      }
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const dismissAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/alerts/${alertId}/dismiss`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.alert_id !== alertId));
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const generateAlerts = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/alerts/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Alerts generated:', data);
        // Refresh alerts list
        fetchAlerts();
        showNotification(`Generated ${data.alerts_created} new alerts!`, 'success');
      } else {
        showNotification('Failed to generate alerts', 'error');
      }
    } catch (error) {
      console.error('Error generating alerts:', error);
      showNotification('Error generating alerts', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ff4757';
      case 'high': return '#ff6b35';
      case 'medium': return '#ffa502';
      case 'low': return '#3742fa';
      default: return '#747d8c';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  };

  const getAlertTypeIcon = (alertType) => {
    switch (alertType) {
      case 'heart_rate': return '❤️';
      case 'respiratory': return '🫁';
      case 'activity': return '🏃';
      case 'temperature': return '🌡️';
      case 'oxygen': return '🩸';
      default: return '📊';
    }
  };

  const unreadCount = alerts.filter(alert => !alert.is_read).length;

  if (loading) {
    return (
      <div className="alerts-container">
        <div className="alerts-loading">
          <div className="loading-spinner"></div>
          <p>Loading your health alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <div className="alerts-title">
          <h1>Health Alerts</h1>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} new</span>
          )}
        </div>
        
        <div className="alerts-filters">
          <button 
            className="generate-btn"
            onClick={generateAlerts}
            disabled={generating}
          >
            {generating ? '🔄 Generating...' : '🤖 Generate New Alerts'}
          </button>
        </div>
      </div>

      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="no-alerts">
            <h3>No alerts to show</h3>
            <p>No health alerts have been generated yet.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div 
              key={alert.alert_id} 
              className={`alert-card ${alert.severity} ${!alert.is_read ? 'unread' : ''}`}
            >
              <div className="alert-header">
                <div className="alert-icons">
                  <span className="alert-type-icon">
                    {getAlertTypeIcon(alert.alert_type)}
                  </span>
                  <span className="alert-severity-icon">
                    {getSeverityIcon(alert.severity)}
                  </span>
                </div>
                
                <div className="alert-meta">
                  <span className="alert-time">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                  {!alert.is_read && <span className="new-indicator">NEW</span>}
                </div>
              </div>

              <div className="alert-content">
                <h3 className="alert-title">{alert.title}</h3>
                <p className="alert-message">{alert.message}</p>
                
                {/* Doctor Review Status */}
                <div className="doctor-review-status">
                  {alert.is_read ? (
                    <span className="review-status reviewed">
                      ✅ Doctor Reviewed
                    </span>
                  ) : (
                    <span className="review-status pending">
                      ⏳ Doctor Review Pending
                    </span>
                  )}
                </div>
                
                {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                  <div className="alert-metadata">
                    <strong>Details:</strong>
                    <ul>
                      {Object.entries(alert.metadata).map(([key, value]) => (
                        <li key={key}>
                          <span className="meta-key">{key.replace(/_/g, ' ')}:</span>
                          <span className="meta-value">{value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="alert-actions">
                <span className={`severity-badge ${alert.severity}`}>
                  {alert.severity.toUpperCase()}
                </span>
                
                <button 
                  className="dismiss-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(alert.alert_id);
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
            onClick={() => setNotification(null)}
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

export default Alerts;
