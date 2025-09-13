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

// GET conversations for current user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get existing conversations with last message and unread count
    const conversationsResult = await pool.query(`
      SELECT DISTINCT 
        CASE 
          WHEN m.sender_id = $1 THEN m.receiver_id 
          ELSE m.sender_id 
        END as user_id,
        u.first_name,
        u.last_name,
        u.email,
        d.specialization,
        (
          SELECT content 
          FROM messages m2 
          WHERE (m2.sender_id = $1 AND m2.receiver_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
             OR (m2.receiver_id = $1 AND m2.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
          ORDER BY m2.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at 
          FROM messages m2 
          WHERE (m2.sender_id = $1 AND m2.receiver_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
             OR (m2.receiver_id = $1 AND m2.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
          ORDER BY m2.created_at DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM messages m3 
          WHERE m3.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
            AND m3.receiver_id = $1 
            AND m3.is_read = false
        ) as unread_count
      FROM messages m
      JOIN users u ON u.user_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
      LEFT JOIN doctors d ON u.user_id = d.user_id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY last_message_time DESC
    `, [userId]);

    // Get connected doctor if user is a patient
    const connectedDoctorResult = await pool.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.email, d.specialization
      FROM patients p
      JOIN doctors d ON p.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE p.user_id = $1 AND p.doctor_id IS NOT NULL
    `, [userId]);

    // Get connected patients if user is a doctor
    const connectedPatientsResult = await pool.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.email
      FROM doctors d
      JOIN patients p ON d.doctor_id = p.doctor_id
      JOIN users u ON p.user_id = u.user_id
      WHERE d.user_id = $1
    `, [userId]);

    let conversations = conversationsResult.rows;

    // If user has a connected doctor, ensure they appear in conversations
    if (connectedDoctorResult.rows.length > 0) {
      const connectedDoctor = connectedDoctorResult.rows[0];
      
      // Check if doctor is already in conversations
      const doctorExists = conversations.find(conv => conv.user_id === connectedDoctor.user_id);
      
      if (!doctorExists) {
        // Add connected doctor with empty conversation
        conversations.unshift({
          user_id: connectedDoctor.user_id,
          first_name: connectedDoctor.first_name,
          last_name: connectedDoctor.last_name,
          email: connectedDoctor.email,
          specialization: connectedDoctor.specialization,
          last_message: 'Start a conversation with your doctor',
          last_message_time: null,
          unread_count: 0
        });
      }
    }

    // If user is a doctor with connected patients, ensure they appear in conversations
    if (connectedPatientsResult.rows.length > 0) {
      const connectedPatients = connectedPatientsResult.rows;
      
      connectedPatients.forEach(patient => {
        // Check if patient is already in conversations
        const patientExists = conversations.find(conv => conv.user_id === patient.user_id);
        
        if (!patientExists) {
          // Add connected patient with empty conversation
          conversations.unshift({
            user_id: patient.user_id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            email: patient.email,
            last_message: 'Start a conversation with your patient',
            last_message_time: null,
            unread_count: 0
          });
        }
      });
    }

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET messages between current user and another user
router.get('/messages/:userId', authenticateToken, async (req, res) => {
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
             receiver.last_name as receiver_last_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.user_id
      JOIN users receiver ON m.receiver_id = receiver.user_id
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

// POST send a new message
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { content, receiver_id } = req.body;

    if (!content || !receiver_id) {
      return res.status(400).json({ error: 'Content and receiver_id are required' });
    }

    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `, [senderId, receiver_id, content]);

    res.status(201).json({
      message: 'Message sent successfully',
      data: result.rows[0]
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
