import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts'
import './Dashboard.css'
import { authenticatedFetch } from '../utils/auth'
import API_BASE_URL from '../config/api.js'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dashboard Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard-error">
          <h2>Something went wrong</h2>
          <p>Please refresh the page or try again later.</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function Dashboard() {
  const [healthData, setHealthData] = useState({
    currentMetrics: {
      heart_rate: null,
      respiratory_rate: null,
      energy_burnt: 0,
      avg_energy: null,
      total_sleep: null,
      time_in_daylight: 0,
      avg_daylight: null,
      steps_today: 0,
      avg_steps: null,
      spo2: null,
      avg_spo2: null,
      hrv: null,
      avg_hrv: null,
      wrist_temp: null,
      avg_wrist_temp: null
    },
    heartRate: {
      current: null,
      todayData: [],
      averageToday: null
    },
    respiratoryRate: {
      current: null,
      todayData: []
    },
    sleep: {
      latest: null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchDashboardData()
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const userID = localStorage.getItem('userID')
      
      if (!userID) return
      
      const response = await authenticatedFetch(`http://localhost:3001/api/auth/users/${userID}`)
      
      if (response && response.ok) {
        const userData = await response.json()
        setUser(userData)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
      
      console.log('Fetching dashboard data from backend...')
      
      // Fetch all dashboard data in parallel
      const responses = await Promise.allSettled([
        fetch(`${API_BASE_URL}/health-data/heart-rate/current`, { headers }),
        fetch(`${API_BASE_URL}/health-data/heart-rate/today`, { headers }),
        fetch(`${API_BASE_URL}/health-data/heart-rate/average-today`, { headers }),
        fetch(`${API_BASE_URL}/health-data/respiratory-rate/current`, { headers }),
        fetch(`${API_BASE_URL}/health-data/respiratory-rate/today`, { headers }),
        fetch(`${API_BASE_URL}/health-data/steps/today`, { headers }),
        fetch(`${API_BASE_URL}/health-data/daylight/today`, { headers }),
        fetch(`${API_BASE_URL}/health-data/sleep/latest`, { headers }),
        fetch(`${API_BASE_URL}/health-data/energy/today`, { headers }),
        fetch(`${API_BASE_URL}/health-data/spo2/current`, { headers }),
        fetch(`${API_BASE_URL}/health-data/hrv/current`, { headers }),
        fetch(`${API_BASE_URL}/health-data/temperature/current`, { headers })
      ])

      // Process responses
      const [
        heartRateData,
        heartRateTodayData,
        heartRateAvgData,
        respiratoryRateData,
        respiratoryRateTodayData,
        stepsData,
        daylightData,
        sleepData,
        energyData,
        spo2Data,
        hrvData,
        temperatureData
      ] = await Promise.all(responses.map(async (response, index) => {
        const endpoints = [
          'heart-rate/current', 'heart-rate/today', 'heart-rate/average-today', 
          'respiratory-rate/current', 'respiratory-rate/today',
          'steps/today', 'daylight/today', 'sleep/latest', 'energy/today',
          'spo2/current', 'hrv/current', 'temperature/current'
        ]
        
        if (response.status === 'fulfilled' && response.value.ok) {
          try {
            const data = await response.value.json()
            console.log(`✅ ${endpoints[index]}:`, data)
            return data
          } catch (e) {
            console.warn(`❌ Failed to parse JSON for ${endpoints[index]}:`, e)
            return null
          }
        } else {
          console.warn(`❌ API call failed for ${endpoints[index]}:`, 
            response.reason || `Status: ${response.value?.status}`)
          return null
        }
      }))

      // Update state with real data
      setHealthData({
        currentMetrics: {
          heart_rate: heartRateData?.current_heart_rate || null,
          respiratory_rate: respiratoryRateData?.current_respiratory_rate || null,
          energy_burnt: energyData?.active_energy_burnt_kcal_today || 0,
          avg_energy: energyData?.avg_energy_last30 || null,
          total_sleep: sleepData?.total_sleep_hours || null,
          time_in_daylight: daylightData?.time_in_daylight_minutes_today || 0,
          avg_daylight: daylightData?.avg_daylight_last30 || null,
          steps_today: stepsData?.steps_today || 0,
          avg_steps: stepsData?.avg_steps_last30 || null,
          spo2: spo2Data?.current_spo2 || null,
          avg_spo2: spo2Data?.avg_spo2_last30 || null,
          hrv: hrvData?.current_hrv || null,
          avg_hrv: hrvData?.avg_hrv_last30 || null,
          wrist_temp: temperatureData?.current_wrist_temp || null,
          avg_wrist_temp: temperatureData?.avg_wrist_temp_last30 || null
        },
        heartRate: {
          current: heartRateData,
          todayData: Array.isArray(heartRateTodayData) ? heartRateTodayData : [],
          averageToday: heartRateAvgData?.avg_bpm_today || null,
          dailyRange: { min_heart_rate: null, max_heart_rate: null }
        },
        respiratoryRate: {
          current: respiratoryRateData,
          todayData: Array.isArray(respiratoryRateTodayData) ? respiratoryRateTodayData : []
        },
        sleep: {
          latest: sleepData,
          weeklyAverage: 0,
          weeklyTimeline: []
        },
        steps: {
          today: stepsData?.steps_today || 0,
          weekly: []
        },
        trends: {
          daily: null,
          weekly: null
        },
        stats: null
      })

      console.log('✅ Dashboard data loaded successfully')
      
    } catch (err) {
      console.error('❌ Error fetching dashboard data:', err)
      setError(`Failed to load dashboard data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes) => {
    if (!minutes) return '0h 0m'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getHeartRateStats = () => {
    if (!healthData.heartRate.todayData || healthData.heartRate.todayData.length === 0) {
      return { min: '--', avg: '--', max: '--' }
    }
    
    const bpmValues = healthData.heartRate.todayData.map(d => d.bpm).filter(bpm => bpm != null)
    if (bpmValues.length === 0) {
      return { min: '--', avg: '--', max: '--' }
    }
    
    const min = Math.min(...bpmValues)
    const max = Math.max(...bpmValues)
    const avg = Math.round(bpmValues.reduce((sum, bpm) => sum + bpm, 0) / bpmValues.length)
    
    return { min, avg, max }
  }

  const getTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'morning'
    if (hour < 17) return 'afternoon'
    return 'evening'
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your health data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Unable to load dashboard</h2>
        <p>{error}</p>
        <button onClick={fetchDashboardData} className="retry-button">
          Try Again
        </button>
        <p className="error-help">
          Make sure your backend server is running on port 3001 and you have health data in your database.
        </p>
      </div>
    )
  }

  return (
    <div className="patient-dashboard">
      <div className="patient-dashboard-header">
        <h1>Good {getTimeOfDay()}, {user?.first_name || 'there'}!</h1>
        <p>Here's your health summary for today</p>
      </div>

      {/* Top Row - Blood Oxygen, HRV, Wrist Temperature */}
      <div className="patient-metrics-grid patient-top-row">
        <div className="patient-metric-card">
          <div className="patient-metric-icon">🫁</div>
          <div className="patient-metric-content">
            <h3>Blood Oxygen</h3>
            <div className="patient-metric-value">
              {healthData.currentMetrics.spo2 ? 
                `${healthData.currentMetrics.spo2}%` : '--'}
            </div>
            {healthData.currentMetrics.avg_spo2 && (
              <p className="patient-metric-subtitle">
                <span className="avg-label">30d avg:</span>
                <span className="avg-value">{healthData.currentMetrics.avg_spo2}%</span>
              </p>
            )}
          </div>
        </div>

        <div className="patient-metric-card">
          <div className="patient-metric-icon">💓</div>
          <div className="patient-metric-content">
            <h3>Heart Rate Variability</h3>
            <div className="patient-metric-value">
              {healthData.currentMetrics.hrv ? 
                `${parseFloat(healthData.currentMetrics.hrv).toFixed(2)}ms` : '--'}
            </div>
            {healthData.currentMetrics.avg_hrv && (
              <p className="patient-metric-subtitle">
                <span className="avg-label">30d avg:</span>
                <span className="avg-value">{parseFloat(healthData.currentMetrics.avg_hrv).toFixed(2)}ms</span>
              </p>
            )}
          </div>
        </div>

        <div className="patient-metric-card">
          <div className="patient-metric-icon">🌡️</div>
          <div className="patient-metric-content">
            <h3>Wrist Temperature</h3>
            <div className="patient-metric-value">
              {healthData.currentMetrics.wrist_temp ? 
                `${parseFloat(healthData.currentMetrics.wrist_temp).toFixed(2)}°C` : '--'}
            </div>
            {healthData.currentMetrics.avg_wrist_temp && (
              <p className="patient-metric-subtitle">
                <span className="avg-label">30d avg:</span>
                <span className="avg-value">{parseFloat(healthData.currentMetrics.avg_wrist_temp).toFixed(2)}°C</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Heart Rate Section - Full Width */}
      <div className="patient-heart-rate-section">
        <div className="patient-metric-card patient-heart-rate-expanded">
          <div className="patient-heart-rate-header">
            <div className="patient-metric-icon">❤️</div>
            <div className="patient-metric-content">
              <h3>Heart Rate</h3>
              <div className="patient-metric-value">
                {healthData.currentMetrics.heart_rate || '--'} 
                <span className="unit">BPM</span>
              </div>
              {healthData.heartRate.current?.reading_time && (
                <p className="patient-metric-subtitle">
                  Last: {new Date(healthData.heartRate.current.reading_time).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Heart Rate Chart */}
          {healthData.heartRate.todayData.length > 0 ? (
            <div className="patient-heart-rate-chart">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart 
                  data={healthData.heartRate.todayData}
                  margin={{ top: 20, right: 40, left: 20, bottom: 60 }}
                  width="100%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="ts_minute" 
                    stroke="rgba(255,255,255,0.6)"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.6)"
                    domain={['dataMin - 10', 'dataMax + 10']}
                    fontSize={11}
                    width={50}
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric'
                    })}
                    formatter={(value) => [`${value} BPM`, 'Heart Rate']}
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid rgba(0, 251, 205, 0.3)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bpm" 
                    stroke="#00fbcd" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#00fbcd', strokeWidth: 2, fill: '#00fbcd' }}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              <div className="patient-heart-rate-stats">
                <div className="patient-hr-stat">
                  <span className="patient-hr-label">Min</span>
                  <span className="patient-hr-value">
                    {getHeartRateStats().min} BPM
                  </span>
                </div>
                <div className="patient-hr-stat">
                  <span className="patient-hr-label">Avg</span>
                  <span className="patient-hr-value">
                    {getHeartRateStats().avg} BPM
                  </span>
                </div>
                <div className="patient-hr-stat">
                  <span className="patient-hr-label">Max</span>
                  <span className="patient-hr-value">
                    {getHeartRateStats().max} BPM
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="patient-no-data-message">
              <p>No heart rate data available for today</p>
            </div>
          )}
        </div>
      </div>

      {/* Respiratory Rate Section - Full Width */}
      <div className="patient-respiratory-rate-section">
        <div className="patient-metric-card patient-respiratory-rate-expanded">
          <div className="patient-respiratory-rate-header">
            <div className="patient-metric-icon">🫁</div>
            <div className="patient-metric-content">
              <h3>Respiratory Rate</h3>
              <div className="patient-metric-value">
                {healthData.currentMetrics.respiratory_rate || '--'} 
                <span className="unit">BPM</span>
              </div>
              {healthData.respiratoryRate.current?.reading_time && (
                <p className="patient-metric-subtitle">
                  Last: {new Date(healthData.respiratoryRate.current.reading_time).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Respiratory Rate Chart */}
          {healthData.respiratoryRate.todayData.length > 0 ? (
            <div className="patient-respiratory-rate-chart">
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart 
                  data={healthData.respiratoryRate.todayData}
                  margin={{ top: 20, right: 40, left: 20, bottom: 60 }}
                  width="100%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="rgba(255,255,255,0.6)"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    type="category"
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.6)"
                    domain={['dataMin - 2', 'dataMax + 2']}
                    fontSize={11}
                    width={50}
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric'
                    })}
                    formatter={(value) => [`${value} BPM`, 'Respiratory Rate']}
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid rgba(255, 165, 0, 0.3)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  />
                  <Scatter 
                    dataKey="respiratory_rate" 
                    fill="#ffa500"
                    stroke="#ffa500"
                    strokeWidth={1}
                    r={4}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="patient-no-data-message">
              <p>No respiratory rate data available for today</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row - Daylight, Active Energy, Steps */}
      <div className="patient-metrics-grid patient-bottom-row">
        <div className="patient-metric-card">
          <div className="patient-metric-icon">☀️</div>
          <div className="patient-metric-content">
            <h3>Daylight Time</h3>
            <div className="patient-metric-value">
              {formatTime(healthData.currentMetrics.time_in_daylight)}
            </div>
            {healthData.currentMetrics.avg_daylight && (
              <p className="patient-metric-subtitle">
                <span className="avg-label">30d avg:</span>
                <span className="avg-value">{formatTime(healthData.currentMetrics.avg_daylight)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="patient-metric-card">
          <div className="patient-metric-icon">🔥</div>
          <div className="patient-metric-content">
            <h3>Active Calories</h3>
            <div className="patient-metric-value">
              {healthData.currentMetrics.energy_burnt ? 
                parseFloat(healthData.currentMetrics.energy_burnt).toFixed(1) : '0.0'}
              <span className="unit">kcal</span>
            </div>
            {healthData.currentMetrics.avg_energy && (
              <p className="patient-metric-subtitle">
                <span className="avg-label">30d avg:</span>
                <span className="avg-value">{parseFloat(healthData.currentMetrics.avg_energy).toFixed(1)} kcal</span>
              </p>
            )}
          </div>
        </div>

        <div className="patient-metric-card">
          <div className="patient-metric-icon">🚶</div>
          <div className="patient-metric-content">
            <h3>Steps Today</h3>
            <div className="patient-metric-value">
              {healthData.currentMetrics.steps_today?.toLocaleString() || '0'}
              <span className="unit">steps</span>
            </div>
            {healthData.currentMetrics.avg_steps && (
              <p className="patient-metric-subtitle">
                <span className="avg-label">30d avg:</span>
                <span className="avg-value">{parseInt(healthData.currentMetrics.avg_steps).toLocaleString()} steps</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Health Stats */}
      {healthData.stats && (
        <div className="stats-section">
          <h2>Health Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Resting HR</span>
              <span className="stat-value">{healthData.stats.recent_resting_hr || '--'} BPM</span>
              <span className="stat-avg">Avg: {healthData.stats.avg_resting_hr || '--'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">HRV</span>
              <span className="stat-value">{healthData.stats.recent_hr_variability || '--'} ms</span>
              <span className="stat-avg">10d avg: {healthData.stats.avg_hr_variability_10d || '--'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Sleep Temp</span>
              <span className="stat-value">{healthData.stats.recent_sleeping_temperature || '--'}°</span>
              <span className="stat-avg">Avg: {healthData.stats.avg_sleeping_temperature || '--'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Trends Section */}
      {healthData.trends.daily && (
        <div className="trends-section">
          <h2>Daily Trends</h2>
          <div className="trends-grid">
            {healthData.trends.daily.sleep_current && (
              <div className="trend-item">
                <span className="trend-label">Sleep</span>
                <span className="trend-value">{healthData.trends.daily.sleep_current}h</span>
                <span className={`trend-change ${healthData.trends.daily.sleep_pct_change >= 0 ? 'positive' : 'negative'}`}>
                  {healthData.trends.daily.sleep_pct_change >= 0 ? '+' : ''}{healthData.trends.daily.sleep_pct_change}%
                </span>
              </div>
            )}
            {healthData.trends.daily.steps_current && (
              <div className="trend-item">
                <span className="trend-label">Steps</span>
                <span className="trend-value">{healthData.trends.daily.steps_current}</span>
                <span className={`trend-change ${healthData.trends.daily.steps_pct_change >= 0 ? 'positive' : 'negative'}`}>
                  {healthData.trends.daily.steps_pct_change >= 0 ? '+' : ''}{healthData.trends.daily.steps_pct_change}%
                </span>
              </div>
            )}
            {healthData.trends.daily.energy_current && (
              <div className="trend-item">
                <span className="trend-label">Energy</span>
                <span className="trend-value">{healthData.trends.daily.energy_current} cal</span>
                <span className={`trend-change ${healthData.trends.daily.energy_pct_change >= 0 ? 'positive' : 'negative'}`}>
                  {healthData.trends.daily.energy_pct_change >= 0 ? '+' : ''}{healthData.trends.daily.energy_pct_change}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly Activity */}
      {healthData.steps.weekly.length > 0 && (
        <div className="activity-section">
          <h2>Weekly Steps</h2>
          <div className="weekly-steps">
            {healthData.steps.weekly.map((day, index) => (
              <div key={index} className="step-day">
                <div className="step-bar">
                  <div 
                    className="step-fill" 
                    style={{ height: `${Math.min((day.total_steps / 10000) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="step-count">{day.total_steps?.toLocaleString()}</span>
                <span className="step-date">{formatDate(day.day)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sleep Timeline */}
      {healthData.sleep.weeklyTimeline.length > 0 && (
        <div className="sleep-section">
          <h2>Sleep Timeline (7 Days)</h2>
          <div className="sleep-timeline">
            {healthData.sleep.weeklyTimeline.map((night, index) => (
              <div key={index} className="sleep-night">
                <div className="sleep-date">{formatDate(night.record_date)}</div>
                <div className="sleep-duration">
                  <div className="sleep-bar">
                    <div className="deep-sleep" style={{ width: `${(night.deep_sleep_hours / 10) * 100}%` }}></div>
                    <div className="core-sleep" style={{ width: `${(night.core_sleep_hours / 10) * 100}%` }}></div>
                    <div className="rem-sleep" style={{ width: `${(night.rem_sleep_hours / 10) * 100}%` }}></div>
                  </div>
                  <span className="sleep-total">{night.total_sleep_hours}h</span>
                </div>
              </div>
            ))}
          </div>
          <div className="sleep-legend">
            <span className="legend-item"><div className="legend-color deep"></div>Deep</span>
            <span className="legend-item"><div className="legend-color core"></div>Core</span>
            <span className="legend-item"><div className="legend-color rem"></div>REM</span>
          </div>
        </div>
      )}

      {/* Sleep Analysis Section */}
      {healthData.sleep.latest && (
        <div className="patient-sleep-analysis-section">
          <h2>Sleep Analysis</h2>
          <div className="patient-sleep-overview">
            <div className="patient-sleep-summary-card">
              <div className="patient-sleep-total">
                <h3>Total Sleep</h3>
                <div className="patient-sleep-time">
                  {healthData.sleep.latest.total_sleep_hours}
                  <span className="unit">hrs</span>
                </div>
                <p className="patient-sleep-date">
                  {formatDate(healthData.sleep.latest.record_date)}
                </p>
              </div>
              
              <div className="patient-sleep-breakdown">
                <div className="patient-sleep-stage">
                  <div className="patient-stage-color deep"></div>
                  <span className="patient-stage-label">Deep Sleep</span>
                  <span className="patient-stage-value">{healthData.sleep.latest.deep_sleep_hours}h</span>
                  <span className="patient-stage-percent">
                    {Math.round((healthData.sleep.latest.deep_sleep_hours / healthData.sleep.latest.total_sleep_hours) * 100)}%
                  </span>
                </div>
                <div className="patient-sleep-stage">
                  <div className="patient-stage-color core"></div>
                  <span className="patient-stage-label">Core Sleep</span>
                  <span className="patient-stage-value">{healthData.sleep.latest.core_sleep_hours}h</span>
                  <span className="patient-stage-percent">
                    {Math.round((healthData.sleep.latest.core_sleep_hours / healthData.sleep.latest.total_sleep_hours) * 100)}%
                  </span>
                </div>
                <div className="patient-sleep-stage">
                  <div className="patient-stage-color rem"></div>
                  <span className="patient-stage-label">REM Sleep</span>
                  <span className="patient-stage-value">{healthData.sleep.latest.rem_sleep_hours}h</span>
                  <span className="patient-stage-percent">
                    {Math.round((healthData.sleep.latest.rem_sleep_hours / healthData.sleep.latest.total_sleep_hours) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="patient-sleep-charts">
              <div className="patient-sleep-pie-chart">
                <h4>Sleep Stage Distribution</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { 
                          name: 'Deep Sleep', 
                          value: parseFloat(healthData.sleep.latest.deep_sleep_hours) || 0, 
                          color: '#3b82f6',
                          percentage: Math.round((parseFloat(healthData.sleep.latest.deep_sleep_hours) / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100)
                        },
                        { 
                          name: 'Core Sleep', 
                          value: parseFloat(healthData.sleep.latest.core_sleep_hours) || 0, 
                          color: '#10b981',
                          percentage: Math.round((parseFloat(healthData.sleep.latest.core_sleep_hours) / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100)
                        },
                        { 
                          name: 'REM Sleep', 
                          value: parseFloat(healthData.sleep.latest.rem_sleep_hours) || 0, 
                          color: '#f59e0b',
                          percentage: Math.round((parseFloat(healthData.sleep.latest.rem_sleep_hours) / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100)
                        }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={100}
                      dataKey="value"
                      label={({name, percentage}) => `${name.split(' ')[0]}: ${percentage}%`}
                      labelLine={false}
                      style={{ fontSize: '10px' }}
                    >
                      {[
                        { color: '#3b82f6' },
                        { color: '#10b981' },
                        { color: '#f59e0b' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${value}h (${Math.round((value / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100)}%)`, name]}
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        border: '1px solid rgba(0, 251, 205, 0.3)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="patient-sleep-legend">
                  <div className="patient-legend-item">
                    <div className="patient-legend-color" style={{backgroundColor: '#3b82f6'}}></div>
                    <span>Deep Sleep</span>
                  </div>
                  <div className="patient-legend-item">
                    <div className="patient-legend-color" style={{backgroundColor: '#10b981'}}></div>
                    <span>Core Sleep</span>
                  </div>
                  <div className="patient-legend-item">
                    <div className="patient-legend-color" style={{backgroundColor: '#f59e0b'}}></div>
                    <span>REM Sleep</span>
                  </div>
                </div>
              </div>

              <div className="patient-sleep-quality-indicators">
                <h4>Sleep Quality Metrics</h4>
                <div className="patient-quality-metrics">
                  <div className="patient-quality-item">
                    <span className="patient-quality-label">Deep Sleep</span>
                    <div className="patient-quality-bar">
                      <div 
                        className="patient-quality-fill deep" 
                        style={{ width: `${Math.min((parseFloat(healthData.sleep.latest.deep_sleep_hours) / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="patient-quality-value">
                      {Math.round((parseFloat(healthData.sleep.latest.deep_sleep_hours) / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100)}%
                    </span>
                  </div>
                  <div className="patient-quality-item">
                    <span className="patient-quality-label">REM Sleep</span>
                    <div className="patient-quality-bar">
                      <div 
                        className="patient-quality-fill rem" 
                        style={{ width: `${Math.min((parseFloat(healthData.sleep.latest.rem_sleep_hours) / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="patient-quality-value">
                      {Math.round((parseFloat(healthData.sleep.latest.rem_sleep_hours) / parseFloat(healthData.sleep.latest.total_sleep_hours)) * 100)}%
                    </span>
                  </div>
                  <div className="patient-quality-item">
                    <span className="patient-quality-label">Sleep Efficiency</span>
                    <div className="patient-quality-bar">
                      <div 
                        className="patient-quality-fill efficiency" 
                        style={{ width: `${Math.min(parseFloat(healthData.sleep.latest.total_sleep_hours) / 8 * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="patient-quality-value">
                      {Math.round(Math.min(parseFloat(healthData.sleep.latest.total_sleep_hours) / 8 * 100, 100))}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="patient-sleep-insights">
            <h4>Sleep Insights</h4>
            <div className="patient-insights-grid">
              <div className="patient-insight-card">
                <div className="patient-insight-icon">🛌</div>
                <div className="patient-insight-content">
                  <h5>Sleep Duration</h5>
                  <p>
                    {healthData.sleep.latest.total_sleep_hours >= 7 && healthData.sleep.latest.total_sleep_hours <= 9 
                      ? "Excellent sleep duration! You're getting optimal rest for recovery and health." 
                      : healthData.sleep.latest.total_sleep_hours >= 6 && healthData.sleep.latest.total_sleep_hours < 7
                        ? "Good sleep duration, but aim for 7-9 hours for optimal health benefits."
                        : healthData.sleep.latest.total_sleep_hours < 6 
                          ? "Sleep duration is below recommended levels. Try to get at least 7-8 hours for better recovery."
                          : "You may be oversleeping. While rest is important, 7-9 hours is typically optimal for most adults."
                    }
                  </p>
                </div>
              </div>
              <div className="patient-insight-card">
                <div className="patient-insight-icon">🧠</div>
                <div className="patient-insight-content">
                  <h5>Deep Sleep</h5>
                  <p>
                    {(() => {
                      const deepPercentage = (healthData.sleep.latest.deep_sleep_hours / healthData.sleep.latest.total_sleep_hours) * 100;
                      if (deepPercentage >= 20) {
                        return "Outstanding deep sleep! Your body is getting excellent physical recovery and restoration.";
                      } else if (deepPercentage >= 15) {
                        return "Good deep sleep levels. Your body is recovering well from daily activities.";
                      } else if (deepPercentage >= 10) {
                        return "Moderate deep sleep. Consider a cooler room temperature and consistent bedtime routine.";
                      } else {
                        return "Low deep sleep detected. Try avoiding caffeine late in the day and creating a darker sleep environment.";
                      }
                    })()}
                  </p>
                </div>
              </div>
              <div className="patient-insight-card">
                <div className="patient-insight-icon">💭</div>
                <div className="patient-insight-content">
                  <h5>REM Sleep</h5>
                  <p>
                    {(() => {
                      const remPercentage = (healthData.sleep.latest.rem_sleep_hours / healthData.sleep.latest.total_sleep_hours) * 100;
                      if (remPercentage >= 25) {
                        return "Excellent REM sleep! Your brain is getting optimal time for memory consolidation and emotional processing.";
                      } else if (remPercentage >= 20) {
                        return "Good REM sleep levels. Your cognitive functions and memory are well-supported.";
                      } else if (remPercentage >= 15) {
                        return "Moderate REM sleep. Consider reducing alcohol intake and managing stress for better dream sleep.";
                      } else {
                        return "Low REM sleep detected. Try maintaining regular sleep schedule and avoiding screens before bed.";
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}

export default function DashboardWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  )
}
