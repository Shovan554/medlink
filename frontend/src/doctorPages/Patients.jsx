import { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [suspectedDiseases, setSuspectedDiseases] = useState([]);

  const fetchPatientDetails = async (patientId) => {
    setModalLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching details for patient:', patientId);
      
      // Fetch both patient details and suspected diseases
      const [detailsResponse, diseasesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/doctor/patient/${patientId}/details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/suspected/diseases/${patientId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (detailsResponse.ok) {
        const data = await detailsResponse.json();
        setPatientData(data);
        console.log('Patient data:', data);
      }
      
      if (diseasesResponse.ok) {
        const diseasesData = await diseasesResponse.json();
        console.log('Diseases response:', diseasesData);
        setSuspectedDiseases(diseasesData.suspected_diseases || []);
      } else {
        console.error('Diseases response error:', diseasesResponse.status);
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const openPatientModal = (patient) => {
    setSelectedPatient(patient);
    fetchPatientDetails(patient.user_id);
  };

  const closePatientModal = () => {
    setSelectedPatient(null);
    setPatientData(null);
    setSuspectedDiseases([]);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/doctor/patients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Sort patients: alerts first (by count desc), then alphabetically
        const sortedPatients = data.sort((a, b) => {
          // First, sort by alert count (descending)
          if (b.alert_count !== a.alert_count) {
            return b.alert_count - a.alert_count;
          }
          // Then sort alphabetically by first name
          return a.first_name.localeCompare(b.first_name);
        });
        setPatients(sortedPatients);
      } else {
        setError('Failed to fetch patients');
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Error loading patients');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 'calc(100vh - 80px)',
        color: 'rgba(255, 255, 255, 0.8)'
      }}>
        <div>Loading patients...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 'calc(100vh - 80px)',
        color: '#ff6b6b'
      }}>
        <div>{error}</div>
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
          My Patients
        </h1>
        <p style={{ 
          margin: 0, 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '1.1rem' 
        }}>
          Monitor and manage your connected patients
        </p>
      </div>

      {/* Patients List */}
      <div style={{ 
        flex: 1, 
        padding: '20px 30px',
        overflowY: 'auto'
      }}>
        {patients.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: 'rgba(255, 255, 255, 0.6)', 
            padding: '60px 20px' 
          }}>
            <h3 style={{ marginBottom: '10px' }}>No patients connected yet</h3>
            <p>Patients will appear here once they connect to your practice</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gap: '15px',
            width: '100%'
          }}>
            {patients.map((patient) => (
              <div
                key={patient.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(0, 251, 205, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {/* Patient Info */}
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#00fbcd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '20px',
                    color: '#1a1a1a',
                    fontWeight: '700',
                    fontSize: '20px'
                  }}>
                    {patient.first_name?.[0]}{patient.last_name?.[0]}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: '0 0 5px 0', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '18px',
                      fontWeight: '600'
                    }}>
                      {patient.first_name} {patient.last_name}
                    </h3>
                    <p style={{ 
                      margin: '0 0 3px 0', 
                      color: 'rgba(255, 255, 255, 0.7)', 
                      fontSize: '14px' 
                    }}>
                      {patient.email}
                    </p>
                    <p style={{ 
                      margin: 0, 
                      color: 'rgba(255, 255, 255, 0.5)', 
                      fontSize: '12px' 
                    }}>
                      {patient.age ? `${patient.age} years old` : 'Age not specified'} • {patient.gender || 'Gender not specified'}
                    </p>
                  </div>
                </div>

                {/* Alerts Count */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '15px' 
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <span style={{ 
                      color: 'rgba(255, 255, 255, 0.7)', 
                      fontSize: '14px' 
                    }}>
                      Alerts:
                    </span>
                    <div style={{
                      backgroundColor: patient.alert_count > 0 ? '#ff6b6b' : 'rgba(255, 255, 255, 0.1)',
                      color: patient.alert_count > 0 ? 'white' : 'rgba(255, 255, 255, 0.7)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {patient.alert_count || 0}
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'rgba(0, 251, 205, 0.1)',
                      color: '#00fbcd',
                      border: '1px solid rgba(0, 251, 205, 0.3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(0, 251, 205, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'rgba(0, 251, 205, 0.1)';
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openPatientModal(patient);
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patient Details Modal */}
      {selectedPatient && (
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
            width: '70%',
            maxHeight: '80vh',
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '30px',
            overflowY: 'auto',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={closePatientModal}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '5px'
              }}
            >
              ✕
            </button>

            {/* Patient Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '30px',
              paddingBottom: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#00fbcd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '20px',
                color: '#1a1a1a',
                fontWeight: '700',
                fontSize: '28px'
              }}>
                {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
              </div>
              <div>
                <h2 style={{
                  margin: '0 0 5px 0',
                  color: '#00fbcd',
                  fontSize: '24px'
                }}>
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </h2>
                <p style={{
                  margin: '0 0 5px 0',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '16px'
                }}>
                  {selectedPatient.email}
                </p>
                <p style={{
                  margin: 0,
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '14px'
                }}>
                  Patient ID: {selectedPatient.user_id}
                </p>
              </div>
            </div>

            {modalLoading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                Loading patient data...
              </div>
            ) : patientData ? (
              <div>
                {/* Today's Metrics */}
                <h3 style={{
                  color: '#00fbcd',
                  fontSize: '20px',
                  marginBottom: '20px'
                }}>
                  Today's Health Metrics
                </h3>
                
                {/* First Row - Heart Rate, Respiratory Rate, Blood Oxygen */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '20px',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 10px 0' }}>Heart Rate</h4>
                    <div style={{ color: '#00fbcd', fontSize: '24px', fontWeight: '600' }}>
                      {patientData.averages.heart_rate || '--'} <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>BPM</span>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 10px 0' }}>Respiratory Rate</h4>
                    <div style={{ color: '#ffa500', fontSize: '24px', fontWeight: '600' }}>
                      {patientData.averages.respiratory_rate || '--'} <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>BPM</span>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 10px 0' }}>Blood Oxygen</h4>
                    <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '600' }}>
                      {patientData.averages.spo2 || '--'} <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>%</span>
                    </div>
                  </div>
                </div>

                {/* Second Row - HRV, Temperature, Active Energy */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '20px',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 10px 0' }}>Heart Rate Variability</h4>
                    <div style={{ color: '#e74c3c', fontSize: '24px', fontWeight: '600' }}>
                      {patientData.averages.hrv ? parseFloat(patientData.averages.hrv).toFixed(2) : '--'} <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>ms</span>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 10px 0' }}>Wrist Temperature</h4>
                    <div style={{ color: '#f39c12', fontSize: '24px', fontWeight: '600' }}>
                      {patientData.averages.wrist_temp ? parseFloat(patientData.averages.wrist_temp).toFixed(2) : '--'} <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>°C</span>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 10px 0' }}>Active Energy</h4>
                    <div style={{ color: '#ff6b6b', fontSize: '24px', fontWeight: '600' }}>
                      {patientData.averages.active_energy || '--'} <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>kcal</span>
                    </div>
                  </div>
                </div>

                {/* Third Row - Sleep */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '20px',
                  marginBottom: '30px'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 10px 0' }}>Sleep</h4>
                    <div style={{ color: '#9b59b6', fontSize: '24px', fontWeight: '600' }}>
                      {patientData.averages.sleep_hours || '--'} <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>hrs</span>
                    </div>
                  </div>
                </div>

                {/* Suspected Diseases Section */}
                {suspectedDiseases && suspectedDiseases.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ 
                      color: '#ff6b6b', 
                      marginBottom: '15px',
                      fontSize: '1.3rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      🔍 Suspected Conditions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {suspectedDiseases.map((disease, index) => (
                        <div key={index} style={{
                          padding: '15px',
                          backgroundColor: 'rgba(255, 107, 107, 0.1)',
                          border: '1px solid rgba(255, 107, 107, 0.3)',
                          borderRadius: '8px'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <h4 style={{ 
                              color: '#ff6b6b', 
                              margin: 0,
                              fontSize: '1.1rem'
                            }}>
                              {disease.condition}
                            </h4>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              backgroundColor: disease.confidence === 'high' ? 'rgba(255, 107, 107, 0.2)' :
                                 disease.confidence === 'medium' ? 'rgba(255, 193, 7, 0.2)' :
                                 'rgba(108, 117, 125, 0.2)',
                              color: disease.confidence === 'high' ? '#ff6b6b' :
                                     disease.confidence === 'medium' ? '#ffc107' :
                                     '#6c757d'
                            }}>
                              {disease.confidence.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ 
                            color: 'rgba(255, 255, 255, 0.8)', 
                            margin: '0 0 8px 0',
                            fontSize: '0.9rem'
                          }}>
                            {disease.recommendation}
                          </p>
                          <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                            <strong>Indicators:</strong> {disease.indicators.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anomalies Section */}
                {patientData.anomalies && patientData.anomalies.length > 0 && (
                  <div>
                    <h3 style={{
                      color: '#ff6b6b',
                      fontSize: '20px',
                      marginBottom: '20px'
                    }}>
                      Health Anomalies Detected
                    </h3>
                    
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '15px'
                    }}>
                      {patientData.anomalies.map((anomaly, index) => (
                        <div key={index} style={{
                          backgroundColor: 'rgba(255, 107, 107, 0.1)',
                          border: '1px solid rgba(255, 107, 107, 0.3)',
                          padding: '15px',
                          borderRadius: '10px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ color: '#ff6b6b', fontWeight: '600' }}>
                              {anomaly.metric} Anomaly
                            </span>
                            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                              {anomaly.severity}
                            </span>
                          </div>
                          <p style={{ 
                            margin: '8px 0 0 0', 
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '14px'
                          }}>
                            {anomaly.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!patientData.anomalies || patientData.anomalies.length === 0) && (
                  <div style={{
                    backgroundColor: 'rgba(0, 251, 205, 0.1)',
                    border: '1px solid rgba(0, 251, 205, 0.3)',
                    padding: '20px',
                    borderRadius: '10px',
                    textAlign: 'center'
                  }}>
                    <span style={{ color: '#00fbcd', fontWeight: '600' }}>
                      ✓ No anomalies detected - Patient metrics are within normal ranges
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
                padding: '40px'
              }}>
                No data available for this patient
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Patients;
