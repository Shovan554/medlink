import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/attachments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

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

// GET connected doctor for current patient (MUST be before /:userId route)
router.get('/connected-doctor', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.email, d.specialization, d.license_no
      FROM patients p
      JOIN doctors d ON p.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE p.user_id = $1 AND p.doctor_id IS NOT NULL
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ doctor: null });
    }

    res.json({ doctor: result.rows[0] });
  } catch (error) {
    console.error('Error fetching connected doctor:', error);
    res.status(500).json({ error: 'Failed to fetch connected doctor' });
  }
});

// GET conversations for current user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get conversations where user is either sender or receiver
    const conversationsResult = await pool.query(`
      WITH latest_messages AS (
        SELECT 
          CASE 
            WHEN sender_id = $1 THEN receiver_id
            ELSE sender_id
          END as other_user_id,
          content as last_message,
          created_at as last_message_time,
          ROW_NUMBER() OVER (
            PARTITION BY CASE 
              WHEN sender_id = $1 THEN receiver_id
              ELSE sender_id
            END 
            ORDER BY created_at DESC
          ) as rn
        FROM messages 
        WHERE sender_id = $1 OR receiver_id = $1
      ),
      unread_counts AS (
        SELECT 
          sender_id as other_user_id,
          COUNT(*) as unread_count
        FROM messages 
        WHERE receiver_id = $1 AND is_read = false
        GROUP BY sender_id
      )
      SELECT 
        lm.other_user_id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(d.specialization, 'Patient') as specialization,
        lm.last_message,
        lm.last_message_time,
        COALESCE(uc.unread_count, 0) as unread_count
      FROM latest_messages lm
      JOIN users u ON lm.other_user_id = u.user_id
      LEFT JOIN doctors d ON u.user_id = d.user_id
      LEFT JOIN unread_counts uc ON lm.other_user_id = uc.other_user_id
      WHERE lm.rn = 1
      ORDER BY lm.last_message_time DESC
    `, [userId]);

    res.json(conversationsResult.rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET messages between current user and another user (updated to include attachments)
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    // Mark messages as read when fetching
    await pool.query(`
      UPDATE messages 
      SET is_read = true 
      WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false
    `, [otherUserId, currentUserId]);

    const result = await pool.query(`
      SELECT m.*, 
             sender.first_name as sender_first_name,
             sender.last_name as sender_last_name,
             receiver.first_name as receiver_first_name,
             receiver.last_name as receiver_last_name,
             a.attachment_id,
             a.file_url,
             a.file_type,
             a.file_size
      FROM messages m
      JOIN users sender ON m.sender_id = sender.user_id
      JOIN users receiver ON m.receiver_id = receiver.user_id
      LEFT JOIN attachments a ON m.message_id = a.message_id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [currentUserId, otherUserId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST send a new message with optional attachment
router.post('/', authenticateToken, (req, res, next) => {
  // Check if this is a multipart request (file upload)
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    // Use multer for multipart requests
    upload.single('attachment')(req, res, next);
  } else {
    // Skip multer for regular JSON requests
    next();
  }
}, async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { content, receiver_id } = req.body;

    if (!content || !receiver_id) {
      return res.status(400).json({ error: 'Content and receiver_id are required' });
    }

    // Insert message
    const messageResult = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content, created_at, is_read)
      VALUES ($1, $2, $3, NOW(), false)
      RETURNING *
    `, [senderId, receiver_id, content]);

    const message = messageResult.rows[0];

    // Handle attachment if present
    if (req.file) {
      const fileUrl = `/uploads/attachments/${req.file.filename}`;
      
      await pool.query(`
        INSERT INTO attachments (message_id, file_url, file_type, file_size, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [message.message_id, fileUrl, req.file.mimetype, req.file.size]);
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// DELETE a message (optional - for message deletion feature)
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const messageId = req.params.messageId;

    // Only allow deletion of own messages
    const result = await pool.query(`
      DELETE FROM messages 
      WHERE message_id = $1 AND sender_id = $2
      RETURNING *
    `, [messageId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
