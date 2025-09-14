

import React, { useState, useEffect } from 'react';
import './DoctorsReport.css';

function DoctorsReport() {
  const [reportData, setReportData] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [patients, setPatients] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(15);
  const [downloading, setDownloading] = useState(false);

  // Metric mappings with display names
  const metricOptions = [
    { value: 'heart_rate', label: 'Heart Rate', type: 'realtime' },
    { value: 'respiratory_rate', label: 'Respiratory Rate', type: 'realtime' },
    { value: 'active_energy', label: 'Active Energy', type: 'realtime' },
    { value: 'step_count', label: 'Step Count', type: 'realtime' },
    { value: 'apple_exercise_time', label: 'Exercise Time', type: 'aggregated' },
    { value: 'basal_energy_burned', label: 'Basal Energy Burned', type: 'aggregated' },
    { value: 'time_in_daylight', label: 'Time in Daylight', type: 'aggregated' },
    { value: 'blood_oxygen_saturation', label: 'Blood Oxygen Saturation', type: 'aggregated' },
    { value: 'apple_sleeping_wrist_tempe', label: 'Wrist Temperature', type: 'aggregated' },
    { value: 'heart_rate_variability', label: 'Heart Rate Variability', type: 'aggregated' },
    { value: 'resting_heart_rate', label: 'Resting Heart Rate', type: 'aggregated' }
  ];

  // Pagination calculations
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = reportData?.data?.slice(indexOfFirstRecord, indexOfLastRecord) || [];
  const totalPages = Math.ceil((reportData?.data?.length || 0) / recordsPerPage);

  useEffect(() => {
    // Set default metric and dates
    setSelectedMetric('heart_rate');
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(weekAgo.toISOString().split('T')[0]);
    
    // Fetch patients
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/doctor/patients', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPatients(data);
        if (data.length > 0) {
          setSelectedPatient(data[0].user_id); // Set first patient as default
        }
      } else {
        setError('Failed to fetch patients');
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Error loading patients');
    }
  };

  const fetchReportData = async () => {
    if (!selectedMetric || !startDate || !endDate || !selectedPatient) {
      setError('Please select patient, metric and date range');
      return;
    }

    setLoading(true);
    setError('');
    setCurrentPage(1);

    try {
      const token = localStorage.getItem('token');
      
      const selectedMetricObj = metricOptions.find(m => m.value === selectedMetric);
      const tableType = selectedMetricObj?.type || 'realtime';

      const params = new URLSearchParams({
        metric_name: selectedMetric,
        start_date: startDate,
        end_date: endDate,
        table_type: tableType
      });

      const response = await fetch(`http://localhost:3001/api/reports/data?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        setError('Failed to fetch report data');
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      setError('Error fetching report data');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    if (!reportData) return;

    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        metric_name: selectedMetric,
        start_date: startDate,
        end_date: endDate,
        table_type: metricOptions.find(m => m.value === selectedMetric)?.type || 'realtime'
      });

      const response = await fetch(`http://localhost:3001/api/reports/download?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const selectedPatientName = patients.find(p => p.user_id === parseInt(selectedPatient));
        const patientName = selectedPatientName ? `${selectedPatientName.first_name}_${selectedPatientName.last_name}` : 'Patient';
        a.download = `${patientName}_${getMetricDisplayName(selectedMetric)}_Report_${startDate}_to_${endDate}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to download report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      setError('Error downloading report');
    } finally {
      setDownloading(false);
    }
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getMetricDisplayName = (metricValue) => {
    const metric = metricOptions.find(m => m.value === metricValue);
    return metric ? metric.label : metricValue;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="doctors-reports-container">
      <h1>Patient Health Data Reports</h1>
      <h3>Generate reports for your patients</h3>
      
      <div className="doctors-reports-controls">
        <div className="doctors-control-group">
          <label>Patient:</label>
          <select 
            value={selectedPatient} 
            onChange={(e) => setSelectedPatient(e.target.value)}
          >
            <option value="">Select a patient</option>
            {patients.map(patient => (
              <option key={patient.user_id} value={patient.user_id}>
                {patient.first_name} {patient.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="doctors-control-group">
          <label>Metric:</label>
          <select 
            value={selectedMetric} 
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            {metricOptions.map(metric => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>

        <div className="doctors-control-group">
          <label>Start Date:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="doctors-control-group">
          <label>End Date:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button 
          className="doctors-search-btn"
          onClick={fetchReportData}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>

      {error && <div className="doctors-error-message">{error}</div>}

      {reportData && (
        <div className="doctors-report-results">
          <div className="doctors-report-header">
            <h2>
              Report Results - {patients.find(p => p.user_id === parseInt(selectedPatient))?.first_name} {patients.find(p => p.user_id === parseInt(selectedPatient))?.last_name}
            </h2>
            <button 
              className="doctors-download-btn"
              onClick={downloadReport}
              disabled={downloading}
            >
              {downloading ? 'Downloading...' : '📄 Download PDF'}
            </button>
          </div>
          
          <div className="doctors-report-summary">
            <p><strong>Patient:</strong> {patients.find(p => p.user_id === parseInt(selectedPatient))?.first_name} {patients.find(p => p.user_id === parseInt(selectedPatient))?.last_name}</p>
            <p><strong>Metric:</strong> {getMetricDisplayName(reportData.metric_name)}</p>
            <p><strong>Date Range:</strong> {reportData.start_date} to {reportData.end_date}</p>
            <p><strong>Total Records:</strong> {reportData.data.length}</p>
            <p><strong>Showing:</strong> {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, reportData.data.length)} of {reportData.data.length}</p>
          </div>

          <div className="doctors-data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Value</th>
                  <th>Units</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((row, index) => (
                  <tr key={index}>
                    <td>{formatDate(row.timestamp)}</td>
                    <td>{formatTime(row.timestamp)}</td>
                    <td>{row.value}</td>
                    <td>{row.units || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="doctors-pagination">
              <button 
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="doctors-pagination-btn"
              >
                Previous
              </button>
              
              <div className="doctors-pagination-numbers">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 2 && pageNumber <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => paginate(pageNumber)}
                        className={`doctors-pagination-btn ${currentPage === pageNumber ? 'active' : ''}`}
                      >
                        {pageNumber}
                      </button>
                    );
                  } else if (
                    pageNumber === currentPage - 3 ||
                    pageNumber === currentPage + 3
                  ) {
                    return <span key={pageNumber} className="doctors-pagination-dots">...</span>;
                  }
                  return null;
                })}
              </div>

              <button 
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="doctors-pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DoctorsReport;
