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

// GET patients for current doctor with alert counts
router.get('/patients', authenticateToken, async (req, res) => {
  try {
    const doctorUserId = req.user.userId;
    
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(alert_counts.alert_count, 0) as alert_count
      FROM doctors d
      JOIN patients p ON d.doctor_id = p.doctor_id
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN (
        SELECT 
          user_id, 
          COUNT(*) as alert_count 
        FROM alerts 
        WHERE is_dismissed = FALSE 
        GROUP BY user_id
      ) alert_counts ON u.user_id = alert_counts.user_id
      WHERE d.user_id = $1
      ORDER BY alert_counts.alert_count DESC, u.first_name ASC
    `, [doctorUserId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET detailed patient data with averages and anomalies
router.get('/patient/:patientId/details', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorUserId = req.user.userId;
    
    // Verify this patient belongs to this doctor
    const patientCheck = await pool.query(`
      SELECT p.user_id 
      FROM doctors d
      JOIN patients p ON d.doctor_id = p.doctor_id
      WHERE d.user_id = $1 AND p.user_id = $2
    `, [doctorUserId, patientId]);
    
    if (patientCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this patient' });
    }

    // Get today's averages for all metrics
    const averagesResult = await pool.query(`
      SELECT 
        -- Realtime metrics (today's averages)
        ROUND(AVG(CASE WHEN hr.metric_name = 'heart_rate' THEN hr.value END)::numeric, 1) as heart_rate,
        ROUND(AVG(CASE WHEN hr.metric_name = 'respiratory_rate' THEN hr.value END)::numeric, 1) as respiratory_rate,
        ROUND(SUM(CASE WHEN hr.metric_name = 'active_energy' THEN hr.value END)::numeric, 1) as active_energy,
        
        -- Aggregated metrics (latest values) - using same pattern as health_data routes
        (SELECT value
         FROM health_aggregated
         WHERE metric_name = 'blood_oxygen_saturation'
         ORDER BY timestamp DESC
         LIMIT 1) AS spo2,
        
        (SELECT ROUND(value::numeric, 2)
         FROM health_aggregated
         WHERE metric_name = 'heart_rate_variability'
         ORDER BY timestamp DESC
         LIMIT 1) AS hrv,
        
        (SELECT ROUND(value::numeric, 2)
         FROM health_aggregated
         WHERE metric_name LIKE 'apple_sleeping_wrist_temperatur%'
         ORDER BY timestamp DESC
         LIMIT 1) AS wrist_temp,
        
        -- Sleep data (latest)
        (SELECT ROUND((deep + core + rem)::numeric, 2)
         FROM sleep_analysis
         ORDER BY record_date DESC
         LIMIT 1) AS sleep_hours
         
      FROM health_realtime hr
      WHERE hr.timestamp::date = CURRENT_DATE
        AND hr.metric_name IN ('heart_rate', 'respiratory_rate', 'active_energy')
    `);

    // Get anomalies for this patient
    const anomaliesResult = await pool.query(`
      SELECT alert_type as metric, severity, message as description, created_at as detected_at
      FROM alerts 
      WHERE user_id = $1 AND is_dismissed = FALSE
      ORDER BY created_at DESC
      LIMIT 10
    `, [patientId]);

    const averages = averagesResult.rows[0] || {};
    const anomalies = anomaliesResult.rows || [];

    res.json({
      averages,
      anomalies
    });
  } catch (error) {
    console.error('Error fetching patient details:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

export default router;
