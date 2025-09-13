
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

// GET doctor availability (weekly schedule)
router.get('/availability', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      `SELECT *, 
       CASE day_of_week 
         WHEN 0 THEN 'Sunday'
         WHEN 1 THEN 'Monday' 
         WHEN 2 THEN 'Tuesday'
         WHEN 3 THEN 'Wednesday'
         WHEN 4 THEN 'Thursday'
         WHEN 5 THEN 'Friday'
         WHEN 6 THEN 'Saturday'
       END as day_name
       FROM doctor_availability 
       WHERE doctor_id = $1 
       ORDER BY day_of_week, start_time`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// POST add doctor availability (weekly recurring)
router.post('/availability', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { day_of_week, start_time, end_time } = req.body;

    if (day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: 'Day of week and times are required' });
    }

    const result = await pool.query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, day_of_week, start_time, end_time]
    );

    res.status(201).json({
      message: 'Availability added successfully',
      availability: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding availability:', error);
    res.status(500).json({ error: 'Failed to add availability' });
  }
});

// DELETE doctor availability
router.delete('/availability/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM doctor_availability WHERE availability_id = $1 AND doctor_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Availability not found' });
    }

    res.json({ message: 'Availability deleted successfully' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
});

// POST create new appointment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { doctor_id, appointment_date, start_time, end_time, notes, appointment_type } = req.body;

    if (!doctor_id || !appointment_date || !start_time || !end_time || !appointment_type) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Check if the time slot is still available
    const conflictCheck = await pool.query(
      `SELECT * FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 
       AND ((start_time <= $3 AND end_time > $3) OR (start_time < $4 AND end_time >= $4))`,
      [doctor_id, appointment_date, start_time, end_time]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Time slot is no longer available' });
    }

    const result = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, notes, appointment_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [patientId, doctor_id, appointment_date, start_time, end_time, notes, appointment_type]
    );

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// GET available slots for a specific doctor and date
router.get('/available-slots/:doctorId/:date', async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.getDay();

    // Get doctor's weekly availability for this day
    const availabilityResult = await pool.query(
      `SELECT *, 
       CASE day_of_week 
         WHEN 0 THEN 'Sunday'
         WHEN 1 THEN 'Monday' 
         WHEN 2 THEN 'Tuesday'
         WHEN 3 THEN 'Wednesday'
         WHEN 4 THEN 'Thursday'
         WHEN 5 THEN 'Friday'
         WHEN 6 THEN 'Saturday'
       END as day_name
       FROM doctor_availability 
       WHERE doctor_id = $1 AND day_of_week = $2
       ORDER BY start_time`,
      [doctorId, dayOfWeek]
    );

    // Get existing appointments for this date (removed status filter since column doesn't exist)
    const appointmentsResult = await pool.query(
      `SELECT start_time, end_time FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2`,
      [doctorId, date]
    );

    const availability = availabilityResult.rows;
    const bookedSlots = appointmentsResult.rows;

    // Generate 1-hour time slots and filter out booked ones
    const availableSlots = [];
    
    availability.forEach(slot => {
      const startTime = slot.start_time;
      const endTime = slot.end_time;
      
      // Convert time strings to minutes for easier calculation
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      // Generate 1-hour slots
      for (let time = startMinutes; time < endMinutes; time += 60) {
        const slotStart = minutesToTime(time);
        const slotEnd = minutesToTime(time + 60);
        
        // Check if this slot conflicts with any booked appointment
        const isBooked = bookedSlots.some(booked => {
          const bookedStart = timeToMinutes(booked.start_time);
          const bookedEnd = timeToMinutes(booked.end_time);
          return (time < bookedEnd && time + 60 > bookedStart);
        });
        
        if (!isBooked) {
          availableSlots.push({
            start_time: slotStart,
            end_time: slotEnd,
            day_name: slot.day_name
          });
        }
      }
    });

    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// Helper functions for time conversion
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// GET patient's appointments
router.get('/patient', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user.userId;
    
    const result = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM appointments a
       JOIN users u ON a.doctor_id = u.user_id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [patientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET doctor's appointments (with debugging)
router.get('/doctor', authenticateToken, async (req, res) => {
  try {
    const doctorUserId = req.user.userId;
    console.log('Doctor user ID:', doctorUserId);
    
    // First, let's see what appointments exist
    const allAppointments = await pool.query('SELECT * FROM appointments LIMIT 5');
    console.log('Sample appointments:', allAppointments.rows);
    
    // Check if user is in doctors table
    const doctorCheck = await pool.query('SELECT * FROM doctors WHERE user_id = $1', [doctorUserId]);
    console.log('Doctor check:', doctorCheck.rows);
    
    // Try direct lookup first
    const result = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM appointments a
       JOIN users u ON a.patient_id = u.user_id
       WHERE a.doctor_id = $1
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [doctorUserId]
    );

    console.log('Appointments found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// PUT update appointment status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    if (!['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if user is either the patient or doctor for this appointment
    const appointmentCheck = await pool.query(
      'SELECT * FROM appointments WHERE appointment_id = $1 AND (patient_id = $2 OR doctor_id = $2)',
      [id, userId]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or access denied' });
    }

    const result = await pool.query(
      'UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE appointment_id = $2 RETURNING *',
      [status, id]
    );

    res.json({
      message: 'Appointment status updated successfully',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

export default router;
