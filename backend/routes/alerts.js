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

// POST generate health alerts using AI analysis
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    // For demo purposes, we're using user_id 8
    const userId = 8;

    // Get the doctor_id for this patient
    const doctorResult = await pool.query(`
      SELECT doctor_id 
      FROM patients 
      WHERE user_id = $1
    `, [userId]);

    const doctorId = doctorResult.rows[0]?.doctor_id;
    
    if (!doctorId) {
      return res.status(400).json({ error: 'Patient is not assigned to a doctor' });
    }

    // Get past hour health data
    const healthDataResult = await pool.query(`
      SELECT
        /* --- realtime metrics (last hour) --- */
        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 1)
                 ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'heart_rate'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS heart_rate_series,

        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 1)
                 ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'respiratory_rate'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS respiratory_rate_series,

        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 0)
                 ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'step_count'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS step_count_series,

        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 0)
                 ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'active_energy'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS active_energy_series,

        /* --- aggregated metrics (last hour) --- */
        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 0)
                 ) ORDER BY timestamp)::text
          FROM health_aggregated
          WHERE metric_name = 'apple_exercise_time'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS exercise_time_series,

        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 0)
                 ) ORDER BY timestamp)::text
          FROM health_aggregated
          WHERE metric_name = 'time_in_daylight'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS time_in_daylight_series,

        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 2)
                 ) ORDER BY timestamp)::text
          FROM health_aggregated
          WHERE metric_name = 'heart_rate_variability'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS heart_rate_variability_series,

        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 2)
                 ) ORDER BY timestamp)::text
          FROM health_aggregated
          WHERE metric_name LIKE 'apple_sleeping_wrist_temperatur%'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS sleeping_wrist_temp_series,

        COALESCE((
          SELECT json_agg(json_build_object(
                   't', to_char(timestamp, 'HH24:MI:SS'),
                   'v', ROUND(value::numeric, 1)
                 ) ORDER BY timestamp)::text
          FROM health_aggregated
          WHERE metric_name = 'blood_oxygen_saturation'
            AND timestamp >= NOW() - INTERVAL '1 hour' 
            AND timestamp <= NOW()
        ), '[]') AS blood_oxygen_saturation_series
    `);

    const healthData = healthDataResult.rows[0] || {};

    // Create prompt for Gemini to analyze health data and generate alerts
    const prompt = `
ROLE: You are MedLink AI — a clinical alert system that analyzes Apple Watch health data to identify concerning patterns.
Analyze the past hour of health metrics and generate specific, actionable alerts for medical professionals.

HEALTH DATA (Past Hour): ${JSON.stringify(healthData)}

TASK: Analyze this data and identify any concerning patterns, anomalies, or health risks. For each concerning finding, generate an alert with:

1. ALERT_TYPE: One of ["heart_rate", "respiratory", "activity", "temperature", "oxygen", "general"]
2. TITLE: Brief, clinical title (max 50 chars)
3. MESSAGE: Detailed explanation for medical staff (max 200 chars)
4. SEVERITY: One of ["low", "medium", "high", "critical"]
5. METADATA: JSON object with relevant metrics/values

CLINICAL THRESHOLDS TO CONSIDER:
- Heart Rate: Resting >100 or <60 bpm, sudden spikes >150 bpm
- Respiratory Rate: >20 or <12 breaths/min
- Blood Oxygen: <95%
- Temperature: Significant deviations from baseline
- Activity: Sudden drops in movement, prolonged inactivity

OUTPUT FORMAT: Return a JSON array of alerts. If no concerning patterns found, return empty array [].
Each alert object should have: {"alert_type": "...", "title": "...", "message": "...", "severity": "...", "metadata": {...}}

EXAMPLE:
[
  {
    "alert_type": "heart_rate",
    "title": "Elevated Heart Rate Detected",
    "message": "Patient's heart rate exceeded 120 bpm for 15+ minutes. Peak: 135 bpm at 14:30. Consider cardiac evaluation.",
    "severity": "medium",
    "metadata": {"peak_hr": 135, "duration_minutes": 18, "time_of_peak": "14:30"}
  }
]
`;

    let alerts = [];
    
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    try {
      // Call Gemini API
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        
        try {
          // Parse AI response as JSON
          const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
          alerts = JSON.parse(cleanResponse);
          
          if (!Array.isArray(alerts)) {
            alerts = [];
          }
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError);
          alerts = [];
        }
      } else {
        console.error('Gemini API error:', geminiResponse.status);
        return res.status(500).json({ error: 'AI analysis failed' });
      }
    } catch (apiError) {
      console.error('Gemini API call failed:', apiError);
      return res.status(500).json({ error: 'AI service unavailable' });
    }

    // Insert alerts into database
    let insertedAlerts = 0;
    for (const alert of alerts) {
      try {
        await pool.query(`
          INSERT INTO alerts (user_id, doctor_id, alert_type, title, message, severity, is_read, is_dismissed, created_at, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, false, false, NOW(), $7)
        `, [
          userId,
          doctorId,
          alert.alert_type || 'general',
          alert.title || 'Health Alert',
          alert.message || 'Abnormal health pattern detected',
          alert.severity || 'medium',
          JSON.stringify(alert.metadata || {})
        ]);
        insertedAlerts++;
      } catch (dbError) {
        console.error('Error inserting alert:', dbError);
      }
    }

    res.json({
      message: `Generated ${insertedAlerts} health alerts`,
      alerts_created: insertedAlerts,
      alerts: alerts
    });

  } catch (error) {
    console.error('Error generating alerts:', error);
    res.status(500).json({ error: 'Failed to generate alerts' });
  }
});

// GET alerts for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT 
        alert_id,
        alert_type,
        title,
        message,
        severity,
        is_read,
        is_dismissed,
        created_at,
        metadata
      FROM alerts 
      WHERE user_id = $1 AND is_dismissed = FALSE
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// PUT mark alert as read
router.put('/:alertId/read', authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user.userId;

    await pool.query(`
      UPDATE alerts 
      SET is_read = true 
      WHERE alert_id = $1 AND user_id = $2
    `, [alertId, userId]);

    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// PUT dismiss alert
router.put('/:alertId/dismiss', authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user.userId;

    // Only set is_dismissed = true, don't touch is_read (that's for doctors only)
    await pool.query(`
      UPDATE alerts 
      SET is_dismissed = true 
      WHERE alert_id = $1 AND user_id = $2
    `, [alertId, userId]);

    res.json({ message: 'Alert dismissed' });
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

export default router;
