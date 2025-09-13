import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
const router = express.Router();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      gender,
      dob,
      phoneNumber
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !dob) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, firstName, lastName, dob'
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user (updated column names)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, gender, dob, phone_number) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING user_id, email, first_name, last_name, role, gender, dob, phone_number`,
      [email, hashedPassword, firstName, lastName, role || 'patient', gender, dob, phoneNumber]
    );

    const newUser = result.rows[0];

    // If user is a patient, create patient record
    if (newUser.role === 'patient') {
      await pool.query(
        `INSERT INTO patients (user_id) VALUES ($1)`,
        [newUser.user_id]
      );
      console.log('Patient record created for user_id:', newUser.user_id);
    }

    // If user is a doctor, create doctor record
    if (newUser.role === 'doctor') {
      await pool.query(
        `INSERT INTO doctors (user_id) VALUES ($1)`,
        [newUser.user_id]
      );
      console.log('Doctor record created for user_id:', newUser.user_id);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.user_id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.user_id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        gender: newUser.gender,
        dob: newUser.dob,
        phoneNumber: newUser.phone_number
      },
      token
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user (updated column names)
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check password (updated column name)
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        gender: user.gender,
        dob: user.dob,
        phoneNumber: user.phone_number
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET user by ID
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Make sure user can only access their own data or if they're a doctor
    if (req.user.userId !== parseInt(userId) && req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
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
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

export default router;
