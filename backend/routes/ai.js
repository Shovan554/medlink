import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

const router = express.Router();

// Gemini API configuration
const GEMINI_API_KEY = 'AIzaSyBgREJzSmWDJTOVlFio3uMXr4fUaXbuPPY';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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

// GET AI conversation history
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT * FROM ai_messages 
      WHERE sender_id = $1 OR receiver_id = $1
      ORDER BY created_at ASC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching AI conversations:', error);
    res.status(500).json({ error: 'Failed to fetch AI conversations' });
  }
});

// POST send message to AI
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Store user message
    await pool.query(`
      INSERT INTO ai_messages (sender_id, receiver_id, content, created_at)
      VALUES ($1, 0, $2, NOW())
    `, [userId, message]);

    // Get health data snapshot
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
        /* --- realtime metrics --- */
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
            'v', ROUND(value::numeric, 0)
          ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'step_count' AND timestamp::date = CURRENT_DATE
        ), '[]') AS step_count_series,
        
        COALESCE((
          SELECT json_agg(json_build_object(
            't', to_char(timestamp, 'HH24:MI:SS'),
            'v', ROUND(value::numeric, 0)
          ) ORDER BY timestamp)::text
          FROM health_realtime
          WHERE metric_name = 'active_energy' AND timestamp::date = CURRENT_DATE
        ), '[]') AS active_energy_series,
        
        /* --- aggregated metrics --- */
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

    // Patinents AI  prompt for Gemini
    const prompt = `
ROLE: You are MedLink AI — a supportive doctor-style assistant.
You speak directly to patients in clear, professional language. Keep responses concise (≤120 words), reassuring, and easy to follow.
Avoid technical jargon patients may not understand (say "oxygen levels" instead of "SpO₂").
Do NOT mention device/brand names. Prefer phrasing like “Looking at your vitals” or “From your recent readings.”

CASUAL TONE RULE:
If the user’s message is casual or worried, begin with one brief, warm line (e.g., “Thanks for sharing—let’s take a look together.”). Otherwise, be direct.

SAFETY:
Suggest healthy actions (hydration, light activity, relaxation, better sleep habits). 
If medications could help, say they should **only be taken if prescribed by their doctor**. 
Never diagnose or prescribe; explain what the data might mean and when follow-up is needed.

USER QUESTION: ${message}

HEALTH SNAPSHOT: ${JSON.stringify(snapshot)}
SLEEP DATA (last 7 days): ${JSON.stringify(sleepData)}
TODAY'S DETAILED METRICS: ${JSON.stringify(todayData)}

TASK:
- Highlight key patterns, spikes, or unusual findings in plain language.
- Use patient-friendly phrasing like “Looking at your vitals…” or “From your recent readings…”.
- Reassure when values are in a safe range.
- Give a short explanation of what this may mean.
- End with 1–2 practical suggestions and the medication reminder (doctor’s guidance only).
`;



    let aiResponse = 'Sorry, I could not process your request right now.';
    
    try {
      // Call Gemini API
      const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
        aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not process your request right now.';
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
      INSERT INTO ai_messages (sender_id, receiver_id, content, created_at)
      VALUES (0, $1, $2, NOW())
    `, [userId, aiResponse]);

    res.json({
      message: 'AI response generated',
      response: aiResponse
    });

  } catch (error) {
    console.error('Error processing AI chat:', error);
    res.status(500).json({ error: 'Failed to process AI chat' });
  }
});

export default router;
