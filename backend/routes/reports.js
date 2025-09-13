import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import PDFDocument from 'pdfkit';

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

// GET available metrics for dropdowns
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const aggregatedMetrics = [
      'apple_exercise_time',
      'basal_energy_burned',
      'time_in_daylight',
      'blood_oxygen_saturation',
      'apple_sleeping_wrist_tempe',
      'heart_rate_variability',
      'resting_heart_rate'
    ];

    const realtimeMetrics = [
      'respiratory_rate',
      'heart_rate',
      'active_energy',
      'step_count'
    ];

    res.json({
      aggregated: aggregatedMetrics,
      realtime: realtimeMetrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET health data by metric and date range
router.get('/data', authenticateToken, async (req, res) => {
  try {
    const { metric_name, start_date, end_date, table_type } = req.query;

    if (!metric_name || !start_date || !end_date || !table_type) {
      return res.status(400).json({ 
        error: 'metric_name, start_date, end_date, and table_type are required' 
      });
    }

    let query;
    if (table_type === 'aggregated') {
      query = `
        SELECT 
          metric_name,
          DATE(timestamp) as date,
          TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
          value,
          units
        FROM health_aggregated
        WHERE metric_name = $1 
          AND DATE(timestamp) BETWEEN $2 AND $3
        ORDER BY timestamp DESC
      `;
    } else if (table_type === 'realtime') {
      query = `
        SELECT 
          metric_name,
          DATE(timestamp) as date,
          TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
          value,
          'N/A' as units
        FROM health_realtime
        WHERE metric_name = $1 
          AND DATE(timestamp) BETWEEN $2 AND $3
        ORDER BY timestamp DESC
      `;
    } else {
      return res.status(400).json({ error: 'table_type must be "aggregated" or "realtime"' });
    }

    const result = await pool.query(query, [metric_name, start_date, end_date]);

    res.json({
      metric_name,
      start_date,
      end_date,
      table_type,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ error: 'Failed to fetch report data' });
  }
});

// GET download report as PDF
router.get('/download', authenticateToken, async (req, res) => {
  try {
    const { metric_name, start_date, end_date, table_type } = req.query;

    if (!metric_name || !start_date || !end_date || !table_type) {
      return res.status(400).json({ 
        error: 'metric_name, start_date, end_date, and table_type are required' 
      });
    }

    // Get the data (same logic as the data endpoint)
    const tableName = table_type === 'realtime' ? 'health_realtime' : 'health_aggregated';
    const query = `
      SELECT * FROM ${tableName} 
      WHERE metric_name = $1 
      AND DATE(timestamp) BETWEEN $2 AND $3 
      ORDER BY timestamp DESC
    `;

    const result = await pool.query(query, [metric_name, start_date, end_date]);

    // Create PDF
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${metric_name}_report_${start_date}_to_${end_date}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('Health Data Report', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(14).text(`Metric: ${metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
    doc.text(`Date Range: ${start_date} to ${end_date}`);
    doc.text(`Total Records: ${result.rows.length}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Add table headers
    doc.fontSize(12).text('Date\t\tTime\t\tValue\t\tUnits', { underline: true });
    doc.moveDown(0.5);

    // Add data rows
    result.rows.forEach(row => {
      const date = new Date(row.timestamp).toISOString().split('T')[0];
      const time = new Date(row.timestamp).toLocaleTimeString('en-US', { hour12: false });
      doc.text(`${date}\t${time}\t${row.value}\t${row.units || 'N/A'}`);
    });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

export default router;
