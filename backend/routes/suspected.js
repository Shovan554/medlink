import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Get 7-day health data and analyze for suspected diseases
router.get('/diseases/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    console.log('Fetching suspected diseases for patient:', patientId);
    
    // Get 7-day comprehensive health data
    const result = await pool.query(`
      WITH days AS (
        SELECT gs::date AS day
        FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') gs
      ),
      per_day AS (
        SELECT
          d.day,
          jsonb_build_object(
            'heart_rate', (
              SELECT jsonb_build_object(
                'count', COUNT(*),
                'min', MIN(hr.value),
                'max', MAX(hr.value),
                'avg', ROUND(AVG(hr.value)::numeric, 2)
              )
              FROM health_realtime hr
              WHERE hr.metric_name = 'heart_rate'
                AND hr.timestamp >= d.day AND hr.timestamp < d.day + 1
            ),
            'resting_heart_rate', (
              SELECT jsonb_build_object(
                'count', COUNT(*),
                'min', MIN(hr.value),
                'max', MAX(hr.value),
                'avg', ROUND(AVG(hr.value)::numeric, 2)
              )
              FROM health_realtime hr
              WHERE hr.metric_name = 'resting_heart_rate'
                AND hr.timestamp >= d.day AND hr.timestamp < d.day + 1
            ),
            'respiratory_rate', (
              SELECT jsonb_build_object(
                'count', COUNT(*),
                'min', MIN(hr.value),
                'max', MAX(hr.value),
                'avg', ROUND(AVG(hr.value)::numeric, 2)
              )
              FROM health_realtime hr
              WHERE hr.metric_name = 'respiratory_rate'
                AND hr.timestamp >= d.day AND hr.timestamp < d.day + 1
            ),
            'blood_oxygen', (
              SELECT jsonb_build_object(
                'count', COUNT(*),
                'min', MIN(hr.value),
                'max', MAX(hr.value),
                'avg', ROUND(AVG(hr.value)::numeric, 2)
              )
              FROM health_realtime hr
              WHERE hr.metric_name = 'blood_oxygen'
                AND hr.timestamp >= d.day AND hr.timestamp < d.day + 1
            ),
            'active_energy', (
              SELECT jsonb_build_object(
                'count', COUNT(*),
                'sum', ROUND(SUM(hr.value)::numeric, 2),
                'avg', ROUND(AVG(hr.value)::numeric, 2)
              )
              FROM health_realtime hr
              WHERE hr.metric_name = 'active_energy'
                AND hr.timestamp >= d.day AND hr.timestamp < d.day + 1
            ),
            'total_sleep', (
              SELECT jsonb_build_object(
                'total_minutes', COALESCE(ROUND(SUM(
                  EXTRACT(EPOCH FROM (
                    LEAST(sa.sleep_end, (d.day + 1)) - GREATEST(sa.sleep_start, d.day)
                  )) / 60.0
                )::numeric, 2), 0)
              )
              FROM sleep_analysis sa
              WHERE sa.sleep_end > d.day AND sa.sleep_start < d.day + 1
            )
          ) AS metrics
        FROM days d
      )
      SELECT jsonb_build_object(
        'start_date', (SELECT MIN(day) FROM days),
        'end_date', (SELECT MAX(day) FROM days),
        'days', jsonb_agg(
          jsonb_build_object('date', day, 'metrics', metrics)
          ORDER BY day
        )
      ) AS week
      FROM per_day;
    `);

    const healthData = result.rows[0]?.week;
    console.log('Health data retrieved:', healthData ? 'Yes' : 'No');
    console.log('Health data sample:', JSON.stringify(healthData, null, 2).substring(0, 500));
    
    if (!healthData) {
      console.log('No health data found, returning empty array');
      return res.json({ suspected_diseases: [] });
    }

    // For testing, return some mock data first
    const mockDiseases = [
      {
        "condition": "Sleep Apnea",
        "confidence": "medium",
        "indicators": ["irregular sleep patterns", "low blood oxygen during sleep"],
        "recommendation": "Consider sleep study evaluation"
      }
    ];

    console.log('Returning suspected diseases:', mockDiseases);
    res.json({ suspected_diseases: mockDiseases });

  } catch (error) {
    console.error('Error analyzing suspected diseases:', error);
    res.status(500).json({ error: 'Failed to analyze health data' });
  }
});

export default router;
