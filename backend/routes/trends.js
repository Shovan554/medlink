import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Get comprehensive trend data for patient
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get daily trends (today vs yesterday)
    const dailyTrends = await getDailyTrends(userId);
    
    // Get weekly trends (this week vs last week)
    const weeklyTrends = await getWeeklyTrends(userId);
    
    // Get monthly trends (this month vs last month)
    const monthlyTrends = await getMonthlyTrends(userId);

    res.json({
      daily: dailyTrends,
      weekly: weeklyTrends,
      monthly: monthlyTrends
    });
  } catch (error) {
    console.error('Error fetching trend data:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

async function getDailyTrends(userId) {
  // Get respiratory rate data
  const respiratoryQuery = `
    SELECT
      (SELECT ROUND(value)::int
       FROM health_realtime
       WHERE metric_name = 'respiratory_rate'
         AND timestamp::date = CURRENT_DATE
       ORDER BY timestamp DESC
       LIMIT 1) AS latest_rr_current,

      (SELECT ROUND(value)::int
       FROM health_realtime
       WHERE metric_name = 'respiratory_rate'
         AND timestamp::date = CURRENT_DATE - INTERVAL '1 day'
       ORDER BY timestamp DESC
       LIMIT 1) AS latest_rr_previous
  `;

  // Get active calories data
  const caloriesQuery = `
    SELECT 
      COALESCE(ROUND(SUM(CASE WHEN timestamp::date = CURRENT_DATE THEN value END))::int, 0) AS calories_current,
      COALESCE(ROUND(SUM(CASE WHEN timestamp::date = CURRENT_DATE - INTERVAL '1 day' THEN value END))::int, 0) AS calories_previous
    FROM health_realtime
    WHERE metric_name = 'active_energy'
      AND timestamp::date >= CURRENT_DATE - INTERVAL '1 day'
  `;

  // Get wrist temperature data (last 2 recent days)
  const temperatureQuery = `
    SELECT 
      sub.day,
      ROUND(AVG(sub.value)::numeric,2) AS avg_wrist_temp
    FROM (
      SELECT 
        timestamp::date AS day,
        value
      FROM health_aggregated
      WHERE metric_name LIKE 'apple_sleeping_wrist_temperatur%'
      ORDER BY timestamp DESC
      LIMIT 2
    ) sub
    GROUP BY sub.day
    ORDER BY sub.day DESC
  `;

  // Get heart rate and sleep data
  const heartRateQuery = `
    SELECT 
      AVG(CASE WHEN timestamp::date = CURRENT_DATE THEN value END) as heart_rate_current,
      AVG(CASE WHEN timestamp::date = CURRENT_DATE - INTERVAL '1 day' THEN value END) as heart_rate_previous
    FROM health_realtime 
    WHERE metric_name = 'heart_rate'
      AND timestamp >= CURRENT_DATE - INTERVAL '1 day'
  `;

  const sleepQuery = `
    SELECT 
      ROUND((deep + core + rem)::numeric, 2) as total_sleep_hours,
      record_date
    FROM sleep_analysis 
    WHERE record_date >= CURRENT_DATE - INTERVAL '1 day'
    ORDER BY record_date DESC
    LIMIT 2
  `;

  const [respiratoryResult, caloriesResult, temperatureResult, heartRateResult, sleepResult] = await Promise.all([
    pool.query(respiratoryQuery),
    pool.query(caloriesQuery),
    pool.query(temperatureQuery),
    pool.query(heartRateQuery),
    pool.query(sleepQuery)
  ]);

  const respiratory = respiratoryResult.rows[0];
  const calories = caloriesResult.rows[0];
  const temperature = temperatureResult.rows;
  const heartRate = heartRateResult.rows[0];
  const sleep = sleepResult.rows;

  // Process temperature data
  const tempCurrent = temperature.length > 0 ? temperature[0].avg_wrist_temp : 0;
  const tempPrevious = temperature.length > 1 ? temperature[1].avg_wrist_temp : 0;

  // Process sleep data
  const sleepCurrent = sleep.length > 0 ? sleep[0].total_sleep_hours : 0;
  const sleepPrevious = sleep.length > 1 ? sleep[1].total_sleep_hours : 0;

  return {
    spo2_current: 98.5, // Mock data since we don't have this metric yet
    spo2_previous: 98.2,
    spo2_pct_change: calculatePercentageChange(98.5, 98.2),
    
    heart_rate_current: parseFloat(heartRate.heart_rate_current) || 0,
    heart_rate_previous: parseFloat(heartRate.heart_rate_previous) || 0,
    heart_rate_pct_change: calculatePercentageChange(heartRate.heart_rate_current, heartRate.heart_rate_previous),
    
    respiratory_rate_current: parseFloat(respiratory.latest_rr_current) || 0,
    respiratory_rate_previous: parseFloat(respiratory.latest_rr_previous) || 0,
    respiratory_rate_pct_change: calculatePercentageChange(respiratory.latest_rr_current, respiratory.latest_rr_previous),
    
    temperature_current: parseFloat(tempCurrent) || 0,
    temperature_previous: parseFloat(tempPrevious) || 0,
    temperature_pct_change: calculatePercentageChange(tempCurrent, tempPrevious),
    
    calories_current: parseFloat(calories.calories_current) || 0,
    calories_previous: parseFloat(calories.calories_previous) || 0,
    calories_pct_change: calculatePercentageChange(calories.calories_current, calories.calories_previous),
    
    sleep_current: parseFloat(sleepCurrent) || 0,
    sleep_previous: parseFloat(sleepPrevious) || 0,
    sleep_pct_change: calculatePercentageChange(sleepCurrent, sleepPrevious)
  };
}

async function getWeeklyTrends(userId) {
  // Get weekly respiratory rate data
  const respiratoryQuery = `
    SELECT 
      AVG(CASE WHEN timestamp >= DATE_TRUNC('week', CURRENT_DATE) THEN value END) as rr_current,
      AVG(CASE WHEN timestamp >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' 
               AND timestamp < DATE_TRUNC('week', CURRENT_DATE) THEN value END) as rr_previous
    FROM health_realtime
    WHERE metric_name = 'respiratory_rate'
      AND timestamp >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
  `;

  // Get weekly calories data
  const caloriesQuery = `
    SELECT 
      AVG(CASE WHEN timestamp >= DATE_TRUNC('week', CURRENT_DATE) THEN value END) as calories_current,
      AVG(CASE WHEN timestamp >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' 
               AND timestamp < DATE_TRUNC('week', CURRENT_DATE) THEN value END) as calories_previous
    FROM health_realtime
    WHERE metric_name = 'active_energy'
      AND timestamp >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
  `;

  // Get weekly temperature data (last 14 recent readings)
  const temperatureQuery = `
    WITH recent_temps AS (
      SELECT 
        timestamp::date AS day,
        value,
        CASE 
          WHEN timestamp >= DATE_TRUNC('week', CURRENT_DATE) THEN 'current'
          ELSE 'previous'
        END as week_type
      FROM health_aggregated
      WHERE metric_name LIKE 'apple_sleeping_wrist_temperatur%'
      ORDER BY timestamp DESC
      LIMIT 14
    )
    SELECT 
      week_type,
      ROUND(AVG(value)::numeric, 2) as avg_temp
    FROM recent_temps
    GROUP BY week_type
  `;

  // Get weekly heart rate and sleep data
  const heartRateQuery = `
    SELECT 
      AVG(CASE WHEN timestamp >= DATE_TRUNC('week', CURRENT_DATE) THEN value END) as heart_rate_current,
      AVG(CASE WHEN timestamp >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' 
               AND timestamp < DATE_TRUNC('week', CURRENT_DATE) THEN value END) as heart_rate_previous
    FROM health_realtime
    WHERE metric_name = 'heart_rate'
      AND timestamp >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
  `;

  const sleepQuery = `
    SELECT 
      AVG(CASE WHEN record_date >= DATE_TRUNC('week', CURRENT_DATE) THEN (deep + core + rem) END) as sleep_current,
      AVG(CASE WHEN record_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' 
               AND record_date < DATE_TRUNC('week', CURRENT_DATE) THEN (deep + core + rem) END) as sleep_previous
    FROM sleep_analysis
    WHERE record_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
  `;

  const [respiratoryResult, caloriesResult, temperatureResult, heartRateResult, sleepResult] = await Promise.all([
    pool.query(respiratoryQuery),
    pool.query(caloriesQuery),
    pool.query(temperatureQuery),
    pool.query(heartRateQuery),
    pool.query(sleepQuery)
  ]);

  const respiratory = respiratoryResult.rows[0];
  const calories = caloriesResult.rows[0];
  const temperature = temperatureResult.rows;
  const heartRate = heartRateResult.rows[0];
  const sleep = sleepResult.rows[0];

  // Process temperature data
  const tempCurrent = temperature.find(t => t.week_type === 'current')?.avg_temp || 0;
  const tempPrevious = temperature.find(t => t.week_type === 'previous')?.avg_temp || 0;

  return {
    spo2_current: 98.3,
    spo2_previous: 98.1,
    spo2_pct_change: calculatePercentageChange(98.3, 98.1),
    
    heart_rate_current: parseFloat(heartRate.heart_rate_current) || 0,
    heart_rate_previous: parseFloat(heartRate.heart_rate_previous) || 0,
    heart_rate_pct_change: calculatePercentageChange(heartRate.heart_rate_current, heartRate.heart_rate_previous),
    
    respiratory_rate_current: parseFloat(respiratory.rr_current) || 0,
    respiratory_rate_previous: parseFloat(respiratory.rr_previous) || 0,
    respiratory_rate_pct_change: calculatePercentageChange(respiratory.rr_current, respiratory.rr_previous),
    
    temperature_current: parseFloat(tempCurrent) || 0,
    temperature_previous: parseFloat(tempPrevious) || 0,
    temperature_pct_change: calculatePercentageChange(tempCurrent, tempPrevious),
    
    calories_current: parseFloat(calories.calories_current) || 0,
    calories_previous: parseFloat(calories.calories_previous) || 0,
    calories_pct_change: calculatePercentageChange(calories.calories_current, calories.calories_previous),
    
    sleep_current: parseFloat(sleep.sleep_current) || 0,
    sleep_previous: parseFloat(sleep.sleep_previous) || 0,
    sleep_pct_change: calculatePercentageChange(sleep.sleep_current, sleep.sleep_previous)
  };
}

async function getMonthlyTrends(userId) {
  // Get monthly respiratory rate data
  const respiratoryQuery = `
    SELECT 
      AVG(CASE WHEN timestamp >= DATE_TRUNC('month', CURRENT_DATE) THEN value END) as rr_current,
      AVG(CASE WHEN timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
               AND timestamp < DATE_TRUNC('month', CURRENT_DATE) THEN value END) as rr_previous
    FROM health_realtime
    WHERE metric_name = 'respiratory_rate'
      AND timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
  `;

  // Get monthly calories data
  const caloriesQuery = `
    SELECT 
      AVG(CASE WHEN timestamp >= DATE_TRUNC('month', CURRENT_DATE) THEN value END) as calories_current,
      AVG(CASE WHEN timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
               AND timestamp < DATE_TRUNC('month', CURRENT_DATE) THEN value END) as calories_previous
    FROM health_realtime
    WHERE metric_name = 'active_energy'
      AND timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
  `;

  // Get monthly temperature data (last 60 recent readings)
  const temperatureQuery = `
    WITH recent_temps AS (
      SELECT 
        timestamp::date AS day,
        value,
        CASE 
          WHEN timestamp >= DATE_TRUNC('month', CURRENT_DATE) THEN 'current'
          ELSE 'previous'
        END as month_type
      FROM health_aggregated
      WHERE metric_name LIKE 'apple_sleeping_wrist_temperatur%'
      ORDER BY timestamp DESC
      LIMIT 60
    )
    SELECT 
      month_type,
      ROUND(AVG(value)::numeric, 2) as avg_temp
    FROM recent_temps
    GROUP BY month_type
  `;

  // Get monthly heart rate and sleep data
  const heartRateQuery = `
    SELECT 
      AVG(CASE WHEN timestamp >= DATE_TRUNC('month', CURRENT_DATE) THEN value END) as heart_rate_current,
      AVG(CASE WHEN timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
               AND timestamp < DATE_TRUNC('month', CURRENT_DATE) THEN value END) as heart_rate_previous
    FROM health_realtime
    WHERE metric_name = 'heart_rate'
      AND timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
  `;

  const sleepQuery = `
    SELECT 
      AVG(CASE WHEN record_date >= DATE_TRUNC('month', CURRENT_DATE) THEN (deep + core + rem) END) as sleep_current,
      AVG(CASE WHEN record_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
               AND record_date < DATE_TRUNC('month', CURRENT_DATE) THEN (deep + core + rem) END) as sleep_previous
    FROM sleep_analysis
    WHERE record_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
  `;

  const [respiratoryResult, caloriesResult, temperatureResult, heartRateResult, sleepResult] = await Promise.all([
    pool.query(respiratoryQuery),
    pool.query(caloriesQuery),
    pool.query(temperatureQuery),
    pool.query(heartRateQuery),
    pool.query(sleepQuery)
  ]);

  const respiratory = respiratoryResult.rows[0];
  const calories = caloriesResult.rows[0];
  const temperature = temperatureResult.rows;
  const heartRate = heartRateResult.rows[0];
  const sleep = sleepResult.rows[0];

  // Process temperature data
  const tempCurrent = temperature.find(t => t.month_type === 'current')?.avg_temp || 0;
  const tempPrevious = temperature.find(t => t.month_type === 'previous')?.avg_temp || 0;

  return {
    spo2_current: 98.4,
    spo2_previous: 98.0,
    spo2_pct_change: calculatePercentageChange(98.4, 98.0),
    
    heart_rate_current: parseFloat(heartRate.heart_rate_current) || 0,
    heart_rate_previous: parseFloat(heartRate.heart_rate_previous) || 0,
    heart_rate_pct_change: calculatePercentageChange(heartRate.heart_rate_current, heartRate.heart_rate_previous),
    
    respiratory_rate_current: parseFloat(respiratory.rr_current) || 0,
    respiratory_rate_previous: parseFloat(respiratory.rr_previous) || 0,
    respiratory_rate_pct_change: calculatePercentageChange(respiratory.rr_current, respiratory.rr_previous),
    
    temperature_current: parseFloat(tempCurrent) || 0,
    temperature_previous: parseFloat(tempPrevious) || 0,
    temperature_pct_change: calculatePercentageChange(tempCurrent, tempPrevious),
    
    calories_current: parseFloat(calories.calories_current) || 0,
    calories_previous: parseFloat(calories.calories_previous) || 0,
    calories_pct_change: calculatePercentageChange(calories.calories_current, calories.calories_previous),
    
    sleep_current: parseFloat(sleep.sleep_current) || 0,
    sleep_previous: parseFloat(sleep.sleep_previous) || 0,
    sleep_pct_change: calculatePercentageChange(sleep.sleep_current, sleep.sleep_previous)
  };
}

function calculatePercentageChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export default router;
