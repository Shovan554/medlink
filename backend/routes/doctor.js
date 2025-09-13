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

// GET AI conversation history for doctor
router.get('/ai/conversations', authenticateToken, async (req, res) => {
  try {
    const doctorUserId = req.user.userId;
    
    const result = await pool.query(`
      SELECT * FROM doctor_ai_messages 
      WHERE (sender_id = $1 AND receiver_id = -1) OR (sender_id = -1 AND receiver_id = $1)
      ORDER BY created_at ASC
    `, [doctorUserId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching doctor AI conversations:', error);
    res.status(500).json({ error: 'Failed to fetch AI conversations' });
  }
});

// POST send message to AI for doctor
router.post('/ai/chat', authenticateToken, async (req, res) => {
  try {
    const doctorUserId = req.user.userId;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Store doctor message
    await pool.query(`
      INSERT INTO doctor_ai_messages (sender_id, receiver_id, content, created_at)
      VALUES ($1, -1, $2, NOW())
    `, [doctorUserId, message]);

    // Get aggregated health data from all patients
    const snapshotResult = await pool.query(`
      SELECT row_to_json(r) AS health_report
      FROM (
        SELECT
          (SELECT ROUND(value)::int FROM health_realtime WHERE metric_name = 'heart_rate' ORDER BY timestamp DESC LIMIT 1) AS current_heart_rate,
          (SELECT ROUND(AVG(value))::int FROM health_realtime WHERE metric_name = 'heart_rate' AND timestamp::date = CURRENT_DATE) AS avg_heart_rate_today,
          (SELECT ROUND(value)::int FROM health_realtime WHERE metric_name = 'respiratory_rate' ORDER BY timestamp DESC LIMIT 1) AS current_respiratory_rate,
          (SELECT ROUND(AVG(value))::int FROM health_realtime WHERE metric_name = 'respiratory_rate' AND timestamp::date = CURRENT_DATE) AS avg_respiratory_rate_today,
          (SELECT COALESCE(SUM(value),0)::int FROM health_realtime WHERE metric_name = 'step_count' AND timestamp::date = CURRENT_DATE) AS total_steps_today,
          (SELECT COALESCE(SUM(value),0)::int FROM health_realtime WHERE metric_name = 'active_energy' AND timestamp::date = CURRENT_DATE) AS active_energy_kcal_today,
          (SELECT value FROM health_aggregated WHERE metric_name = 'blood_oxygen_saturation' ORDER BY timestamp DESC LIMIT 1) AS blood_oxygen_saturation_latest
      ) AS r
    `);

    // Get sleep data for the last 7 days
    const sleepResult = await pool.query(`
      SELECT
        record_date,
        ROUND(deep::numeric, 2) AS deep_sleep_hours,
        ROUND(core::numeric, 2) AS core_sleep_hours,
        ROUND(rem::numeric,  2) AS rem_sleep_hours,
        ROUND((deep + core + rem)::numeric, 2) AS total_sleep_hours,
        CASE WHEN (deep + core + rem) > 0
             THEN ROUND((100.0 * deep / (deep + core + rem))::numeric, 1)
             ELSE NULL
        END AS deep_pct,
        CASE WHEN (deep + core + rem) > 0
             THEN ROUND((100.0 * core / (deep + core + rem))::numeric, 1)
             ELSE NULL
        END AS core_pct,
        CASE WHEN (deep + core + rem) > 0
             THEN ROUND((100.0 * rem / (deep + core + rem))::numeric, 1)
             ELSE NULL
        END AS rem_pct
      FROM sleep_analysis
      WHERE record_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY record_date DESC
      LIMIT 7
    `);

    // Get comprehensive health data for today
    const todayDataResult = await pool.query(`
      SELECT 
        COALESCE((
          SELECT json_agg(json_build_object(
            't', to_char(timestamp, 'HH24:MI:SS'),
            'v', ROUND(value::numeric, 1)
          ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'heart_rate' AND timestamp::date = CURRENT_DATE
        ), '[]') AS heart_rate_series,
        
        COALESCE((
          SELECT json_agg(json_build_object(
            't', to_char(timestamp, 'HH24:MI:SS'),
            'v', ROUND(value::numeric, 1)
          ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'respiratory_rate' AND timestamp::date = CURRENT_DATE
        ), '[]') AS respiratory_rate_series,
        
        COALESCE((
          SELECT json_agg(json_build_object(
            't', to_char(timestamp, 'HH24:MI:SS'),
            'v', ROUND(value::numeric, 2)
          ) ORDER BY timestamp)::text
          FROM health_aggregated
          WHERE metric_name = 'heart_rate_variability' AND timestamp::date = CURRENT_DATE
        ), '[]') AS heart_rate_variability_series,
        
        COALESCE((
          SELECT json_agg(json_build_object(
            't', to_char(timestamp, 'HH24:MI:SS'),
            'v', ROUND(value::numeric, 1)
          ) ORDER BY timestamp)::text
          FROM health_aggregated
          WHERE metric_name = 'blood_oxygen_saturation' AND timestamp::date = CURRENT_DATE
        ), '[]') AS blood_oxygen_saturation_series
    `);

    const snapshot = snapshotResult.rows[0]?.health_report || {};
    const sleepData = sleepResult.rows || [];
    const todayData = todayDataResult.rows[0] || {};

    // Create clinical prompt for doctors
    const prompt = `
ROLE: You are MedLink AI — a clinically aware assistant generating a brief note for a physician.
You interpret Apple Watch–derived data (heart rate, respiratory rate, oxygen, HRV, activity, sleep).
Write like a doctor speaking to another doctor (concise, data-first), but DO NOT diagnose or prescribe.
Medication mentions must be framed as "considerations" for clinician judgment only — never as orders.

INPUTS
- doctor_message: ${message}
- snapshot: ${JSON.stringify(snapshot)}
- sleep_last7d: ${JSON.stringify(sleepData)}
- series_recent: ${JSON.stringify(todayData)}

DECISION RULES (use when relevant)
- Resting HR: flag if recent ≥ (7d avg + 5 bpm).
- HRV: flag if current ≤ (10d avg × 0.8).
- RR: flag if sustained >20/min at rest.
- SpO2: flag if <92% or repeated dips <94%.
- Sleep: note reduced total or REM/Deep deficits vs personal 7d avg.
- Spikes: report time window + peak and nadir; relate to symptoms if mentioned.

OUTPUT (≤140 words; no PHI):
Start with a one-line Assessment, then Key Data (nums + trends), then Recommendations.
Use brief clinical language (HR, RR, SpO2, HRV). Avoid jargon patients wouldn't understand if chart is shared.

TONE & SAFETY
- Objective, succinct, actionable.
- For medications: "Medication considerations (clinician judgment only): …" (class/examples OK), no dosing, no prescriptions.
- If concerning thresholds met, suggest appropriate follow-up testing (e.g., Holter, basic labs, sleep study).

FORMAT EXAMPLE
Assessment: Mild sympathetic trend with nocturnal HR spike; oxygen stable.
Key Data: HR now 94 vs 71 avg; spike 112 at 03:24 then 58; RR 15–18; SpO2 95–97; HRV −20% vs 10d; sleep ↓ last 3 nights.
Recommendations: Hydration, sleep hygiene, symptom diary. If dizziness persists, consider Holter and orthostatics.
Medication considerations (clinician judgment only): short-term beta-blocker if persistent symptomatic tachycardia; non-sedating anxiolytics if anxiety suspected.
`;

    let aiResponse = 'Unable to process clinical data at this time.';
    
    try {
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
        aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to process clinical data at this time.';
      } else {
        const errorText = await geminiResponse.text();
        console.error('Gemini API error:', geminiResponse.status, errorText);
        aiResponse = 'I\'m having trouble connecting to my AI service right now. Please try again in a moment.';
      }
    } catch (apiError) {
      console.error('Gemini API call failed:', apiError);
      aiResponse = 'I\'m experiencing technical difficulties. Please try again later.';
    }

    // Store AI response
    await pool.query(`
      INSERT INTO doctor_ai_messages (sender_id, receiver_id, content, created_at)
      VALUES (-1, $1, $2, NOW())
    `, [doctorUserId, aiResponse]);

    res.json({
      message: 'AI response generated',
      response: aiResponse
    });

  } catch (error) {
    console.error('Error processing doctor AI chat:', error);
    res.status(500).json({ error: 'Failed to process AI chat' });
  }
});

export default router;
