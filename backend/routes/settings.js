import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

const router = express.Router();

console.log('Settings routes loaded');

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

// GET patient profile
router.get('/patients/profile', authenticateToken, async (req, res) => {
  console.log('Patient profile route hit');
  try {
    const userId = req.user.userId;
    console.log('User ID:', userId);
    
    const result = await pool.query(
      'SELECT mrn, blood_type, height_cm, weight_kg FROM patients WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT update patient profile
router.put('/patients/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mrn, blood_type, height_cm, weight_kg } = req.body;

    const result = await pool.query(
      `UPDATE patients 
       SET mrn = $1, blood_type = $2, height_cm = $3, weight_kg = $4, updated_at = NOW()
       WHERE user_id = $5
       RETURNING mrn, blood_type, height_cm, weight_kg`,
      [mrn || null, blood_type || null, height_cm || null, weight_kg || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating patient profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET doctor profile
router.get('/doctors/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      'SELECT license_no, specialization, npi FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT update doctor profile
router.put('/doctors/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { license_no, specialization, npi } = req.body;

    const result = await pool.query(
      `UPDATE doctors 
       SET license_no = $1, specialization = $2, npi = $3, updated_at = NOW()
       WHERE user_id = $4
       RETURNING license_no, specialization, npi`,
      [license_no || null, specialization || null, npi || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET available doctors
router.get('/doctors/available', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.email, 
             d.specialization, d.license_no, d.npi
      FROM users u
      JOIN doctors d ON u.user_id = d.user_id
      WHERE u.role = 'doctor'
      ORDER BY u.last_name, u.first_name
    `);

    res.json({ doctors: result.rows });
  } catch (error) {
    console.error('Error fetching available doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET connected doctor for patient
router.get('/patients/connected-doctor', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT u.first_name, u.last_name, u.email, d.specialization, d.license_no
      FROM patients p
      JOIN doctors d ON p.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE p.user_id = $1 AND p.doctor_id IS NOT NULL
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No connected doctor found' });
    }

    res.json({ doctor: result.rows[0] });
  } catch (error) {
    console.error('Error fetching connected doctor:', error);
    res.status(500).json({ error: 'Failed to fetch connected doctor' });
  }
});

// POST connect patient to doctor
router.post('/patients/connect-doctor', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { doctorId } = req.body; // This is the user_id from frontend

    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    // Get the doctor's doctor_id from the doctors table using their user_id
    const doctorResult = await pool.query(
      'SELECT doctor_id FROM doctors WHERE user_id = $1',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const doctorTableId = doctorResult.rows[0].doctor_id;

    // Update patient's doctor_id with the doctors table doctor_id
    const result = await pool.query(
      'UPDATE patients SET doctor_id = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
      [doctorTableId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    res.json({
      message: 'Successfully connected to doctor',
      connection: result.rows[0]
    });
  } catch (error) {
    console.error('Error connecting to doctor:', error);
    res.status(500).json({ error: 'Failed to connect to doctor' });
  }
});

// GET user by ID
router.get('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      'SELECT user_id, first_name, last_name, email, role FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
