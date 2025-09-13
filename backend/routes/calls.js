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

// POST start a new call
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { doctor_id, patient_id } = req.body;

    let patientIdFinal, doctorIdFinal, receiverId;
    
    if (doctor_id) {
      patientIdFinal = userId;
      doctorIdFinal = doctor_id;
      receiverId = doctor_id;
    } else if (patient_id) {
      doctorIdFinal = userId;
      patientIdFinal = patient_id;
      receiverId = patient_id;
    } else {
      return res.status(400).json({ error: 'Either doctor_id or patient_id is required' });
    }

    const callLink = `https://meet.medlink.com/call/${Date.now()}`;

    const result = await pool.query(`
      INSERT INTO calls (patient_id, doctor_id, call_link, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `, [patientIdFinal, doctorIdFinal, callLink]);

    // Get caller info
    const callerInfo = await pool.query(`
      SELECT first_name, last_name FROM users WHERE user_id = $1
    `, [userId]);

    // Emit call notification to receiver
    req.app.get('io').to(`user-${receiverId}`).emit('incoming-call', {
      call: result.rows[0],
      caller: callerInfo.rows[0]
    });

    res.status(201).json({
      message: 'Call started successfully',
      call: result.rows[0]
    });
  } catch (error) {
    console.error('Error starting call:', error);
    res.status(500).json({ error: 'Failed to start call' });
  }
});

// POST respond to call (accept/reject)
router.post('/respond', authenticateToken, async (req, res) => {
  try {
    const { call_id, action } = req.body; // action: 'accept' or 'reject'
    
    const status = action === 'accept' ? 'ongoing' : 'cancelled';
    
    const result = await pool.query(`
      UPDATE calls SET status = $1, updated_at = NOW()
      WHERE call_id = $2
      RETURNING *
    `, [status, call_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = result.rows[0];
    
    // Notify the caller about the response
    const callerId = call.patient_id === req.user.userId ? call.doctor_id : call.patient_id;
    
    req.app.get('io').to(`user-${callerId}`).emit('call-response', {
      call_id: call.call_id,
      action,
      call_link: call.call_link
    });

    res.json({
      message: `Call ${action}ed successfully`,
      call: result.rows[0]
    });
  } catch (error) {
    console.error('Error responding to call:', error);
    res.status(500).json({ error: 'Failed to respond to call' });
  }
});

export default router;
