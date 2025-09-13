
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Get current heart rate
router.get('/heart-rate/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ROUND(value)::integer AS current_heart_rate,
        timestamp             AS reading_time
      FROM health_realtime
      WHERE metric_name = 'heart_rate'
      ORDER BY timestamp DESC
      LIMIT 1;
    `);
    
    res.json(result.rows[0] || { current_heart_rate: null, reading_time: null });
  } catch (error) {
    console.error('Error fetching heart rate:', error);
    res.status(500).json({ error: 'Failed to fetch heart rate data' });
  }
});

// Get heart rate data for today (minute averages)
router.get('/heart-rate/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        date_trunc('minute', timestamp) AS ts_minute,
        ROUND(AVG(value)::numeric, 1)   AS bpm
      FROM health_realtime
      WHERE metric_name = 'heart_rate'
        AND timestamp::date = CURRENT_DATE
      GROUP BY 1
      ORDER BY 1;
    `);
    
    console.log('Heart rate today query result:', result.rows.length, 'records');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching heart rate data:', error);
    res.status(500).json({ error: 'Failed to fetch heart rate data' });
  }
});

// Get steps today
router.get('/steps/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(ROUND(SUM(value))::integer, 0) AS steps_today,
        (SELECT ROUND(AVG(daily_steps)::numeric, 0)
         FROM (
           SELECT DATE(timestamp) as day, SUM(value) as daily_steps
           FROM health_realtime
           WHERE metric_name = 'step_count'
             AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
           GROUP BY DATE(timestamp)
           ORDER BY day DESC
           LIMIT 30
         ) t) AS avg_steps_last30
      FROM health_realtime
      WHERE metric_name = 'step_count'
        AND timestamp::date = CURRENT_DATE;
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching steps:', error);
    res.status(500).json({ error: 'Failed to fetch steps data' });
  }
});

// Get time in daylight today
router.get('/daylight/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(value), 0)::int AS time_in_daylight_minutes_today,
        (SELECT ROUND(AVG(daily_daylight)::numeric, 0)
         FROM (
           SELECT DATE(timestamp) as day, SUM(value) as daily_daylight
           FROM health_aggregated
           WHERE metric_name = 'time_in_daylight'
             AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
           GROUP BY DATE(timestamp)
           ORDER BY day DESC
           LIMIT 30
         ) t) AS avg_daylight_last30
      FROM health_aggregated
      WHERE metric_name = 'time_in_daylight'
        AND timestamp::date = CURRENT_DATE;
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching daylight data:', error);
    res.status(500).json({ error: 'Failed to fetch daylight data' });
  }
});

// Get latest sleep data
router.get('/sleep/latest', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        record_date,
        ROUND((deep + core + rem)::numeric, 2) AS total_sleep_hours,
        ROUND(deep::numeric, 2)                 AS deep_sleep_hours,
        ROUND(core::numeric, 2)                 AS core_sleep_hours,
        ROUND(rem::numeric, 2)                  AS rem_sleep_hours
      FROM sleep_analysis
      WHERE record_date = (SELECT MAX(record_date) FROM sleep_analysis)
      LIMIT 1;
    `);
    
    res.json(result.rows[0] || { 
      record_date: null, 
      total_sleep_hours: null, 
      deep_sleep_hours: null, 
      core_sleep_hours: null, 
      rem_sleep_hours: null 
    });
  } catch (error) {
    console.error('Error fetching sleep data:', error);
    res.status(500).json({ error: 'Failed to fetch sleep data' });
  }
});

// Get active energy burnt today
router.get('/energy/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(value), 0) AS active_energy_burnt_kcal_today,
        (SELECT ROUND(AVG(daily_energy)::numeric, 1)
         FROM (
           SELECT DATE(timestamp) as day, SUM(value) as daily_energy
           FROM health_realtime
           WHERE metric_name = 'active_energy'
             AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
           GROUP BY DATE(timestamp)
           ORDER BY day DESC
           LIMIT 30
         ) t) AS avg_energy_last30
      FROM health_realtime
      WHERE metric_name = 'active_energy'
        AND timestamp::date = CURRENT_DATE;
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching energy data:', error);
    res.status(500).json({ error: 'Failed to fetch energy data' });
  }
});

// Get average heart rate for today
router.get('/heart-rate/average-today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ROUND(AVG(value)::numeric, 1) AS avg_bpm_today
      FROM health_realtime
      WHERE metric_name = 'heart_rate'
        AND timestamp::date = CURRENT_DATE;
    `);
    
    res.json(result.rows[0] || { avg_bpm_today: null });
  } catch (error) {
    console.error('Error fetching average heart rate:', error);
    res.status(500).json({ error: 'Failed to fetch average heart rate data' });
  }
});

// Get current respiratory rate
router.get('/respiratory-rate/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ROUND(value)::integer AS current_respiratory_rate,
        timestamp             AS reading_time
      FROM health_realtime
      WHERE metric_name = 'respiratory_rate'
      ORDER BY timestamp DESC
      LIMIT 1;
    `);
    
    res.json(result.rows[0] || { current_respiratory_rate: null, reading_time: null });
  } catch (error) {
    console.error('Error fetching respiratory rate:', error);
    res.status(500).json({ error: 'Failed to fetch respiratory rate data' });
  }
});

// Get respiratory rate data for today
router.get('/respiratory-rate/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        timestamp,
        value AS respiratory_rate
      FROM health_realtime
      WHERE metric_name = 'respiratory_rate'
      ORDER BY timestamp DESC
      LIMIT 30;
    `);
    
    console.log('Respiratory rate today query result:', result.rows.length, 'records');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching respiratory rate data:', error);
    res.status(500).json({ error: 'Failed to fetch respiratory rate data' });
  }
});

// Get current blood oxygen saturation
router.get('/spo2/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT value
         FROM health_aggregated
         WHERE metric_name = 'blood_oxygen_saturation'
         ORDER BY timestamp DESC
         LIMIT 1) AS current_spo2,
        (SELECT ROUND(AVG(value)::numeric, 2)
         FROM (
           SELECT value
           FROM health_aggregated
           WHERE metric_name = 'blood_oxygen_saturation'
           ORDER BY timestamp DESC
           LIMIT 30
         ) t) AS avg_spo2_last30;
    `);
    
    res.json(result.rows[0] || { current_spo2: null, avg_spo2_last30: null });
  } catch (error) {
    console.error('Error fetching SpO2:', error);
    res.status(500).json({ error: 'Failed to fetch SpO2 data' });
  }
});

// Get current heart rate variability
router.get('/hrv/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT value
         FROM health_aggregated
         WHERE metric_name = 'heart_rate_variability'
         ORDER BY timestamp DESC
         LIMIT 1) AS current_hrv,
        (SELECT ROUND(AVG(value)::numeric, 2)
         FROM (
           SELECT value
           FROM health_aggregated
           WHERE metric_name = 'heart_rate_variability'
           ORDER BY timestamp DESC
           LIMIT 30
         ) t) AS avg_hrv_last30;
    `);
    
    res.json(result.rows[0] || { current_hrv: null, avg_hrv_last30: null });
  } catch (error) {
    console.error('Error fetching HRV:', error);
    res.status(500).json({ error: 'Failed to fetch HRV data' });
  }
});

// Get current wrist temperature
router.get('/temperature/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT value
         FROM health_aggregated
         WHERE metric_name LIKE 'apple_sleeping_wrist_temperatur%'
         ORDER BY timestamp DESC
         LIMIT 1) AS current_wrist_temp,
        (SELECT ROUND(AVG(value)::numeric, 2)
         FROM (
           SELECT value
           FROM health_aggregated
           WHERE metric_name LIKE 'apple_sleeping_wrist_temperatur%'
           ORDER BY timestamp DESC
           LIMIT 30
         ) t) AS avg_wrist_temp_last30;
    `);
    
    res.json(result.rows[0] || { current_wrist_temp: null, avg_wrist_temp_last30: null });
  } catch (error) {
    console.error('Error fetching wrist temperature:', error);
    res.status(500).json({ error: 'Failed to fetch wrist temperature data' });
  }
});

// Get dashboard data (aggregated)
router.get('/dashboard', async (req, res) => {
  try {
    // Fetch all the data the dashboard needs in parallel
    const [
      currentHeartRate,
      heartRateToday,
      stepsToday,
      energyToday,
      daylightToday,
      sleepLatest,
      avgHeartRateToday,
      currentRespiratoryRate,
      respiratoryRateToday
    ] = await Promise.all([
      pool.query(`SELECT ROUND(value)::integer AS current_heart_rate, timestamp AS reading_time FROM health_realtime WHERE metric_name = 'heart_rate' ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT date_trunc('minute', timestamp) AS ts_minute, ROUND(AVG(value)::numeric, 1) AS bpm FROM health_realtime WHERE metric_name = 'heart_rate' AND timestamp::date = CURRENT_DATE GROUP BY 1 ORDER BY 1`),
      pool.query(`SELECT COALESCE(ROUND(SUM(value))::integer, 0) AS steps_today FROM health_realtime WHERE metric_name = 'step_count' AND timestamp::date = CURRENT_DATE`),
      pool.query(`SELECT COALESCE(SUM(value), 0) AS active_energy_burnt_kcal_today FROM health_realtime WHERE metric_name = 'active_energy' AND timestamp::date = CURRENT_DATE`),
      pool.query(`SELECT COALESCE(SUM(value), 0)::int AS time_in_daylight_minutes_today FROM health_aggregated WHERE metric_name = 'time_in_daylight' AND timestamp::date = CURRENT_DATE`),
      pool.query(`SELECT record_date, ROUND((deep + core + rem)::numeric, 2) AS total_sleep_hours, ROUND(deep::numeric, 2) AS deep_sleep_hours, ROUND(core::numeric, 2) AS core_sleep_hours, ROUND(rem::numeric, 2) AS rem_sleep_hours FROM sleep_analysis WHERE record_date = (SELECT MAX(record_date) FROM sleep_analysis) LIMIT 1`),
      pool.query(`SELECT ROUND(AVG(value)::numeric, 1) AS avg_bpm_today FROM health_realtime WHERE metric_name = 'heart_rate' AND timestamp::date = CURRENT_DATE`),
      pool.query(`SELECT ROUND(value)::integer AS current_respiratory_rate, timestamp AS reading_time FROM health_realtime WHERE metric_name = 'respiratory_rate' ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT timestamp, value AS respiratory_rate FROM health_realtime WHERE metric_name = 'respiratory_rate' ORDER BY timestamp DESC LIMIT 30`)
    ]);

    const dashboardData = {
      currentMetrics: {
        heart_rate: currentHeartRate.rows[0]?.current_heart_rate || null,
        respiratory_rate: currentRespiratoryRate.rows[0]?.current_respiratory_rate || null,
        energy_burnt: energyToday.rows[0]?.active_energy_burnt_kcal_today || 0,
        steps_today: stepsToday.rows[0]?.steps_today || 0,
        total_sleep: sleepLatest.rows[0]?.total_sleep_hours || null,
        time_in_daylight: daylightToday.rows[0]?.time_in_daylight_minutes_today || 0
      },
      heartRate: {
        current: currentHeartRate.rows[0] || null,
        todayData: heartRateToday.rows
      },
      respiratoryRate: {
        current: currentRespiratoryRate.rows[0] || null,
        todayData: respiratoryRateToday.rows
      },
      sleep: {
        latest: sleepLatest.rows[0] || null
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;

