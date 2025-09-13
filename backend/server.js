import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import healthDataRoutes from './routes/health_data.js';
import settingsRoutes from './routes/settings.js';
import messagesRoutes from './routes/messages.js';
import doctorRoutes from './routes/doctor.js';
import appointmentRoutes from './routes/appointments.js';
import reportsRoutes from './routes/reports.js';
import trendsRoutes from './routes/trends.js';
import dotenv from 'dotenv';
dotenv.config();

import pool from './config/database.js';
import axios from 'axios';
import callsRoutes from './routes/calls.js';
import aiRoutes from './routes/ai.js';
import alertsRoutes from './routes/alerts.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server and Socket.IO after app is defined
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Make io available to routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Helper functions for data normalization
function normalizeSample(sample, units) {
  try {
    // Handle different sample formats
    let value, timestamp;
    
    if (sample.qty !== undefined) {
      value = sample.qty;
    } else if (sample.Avg !== undefined) {
      value = sample.Avg;
    } else if (sample.value !== undefined) {
      value = sample.value;
    } else {
      console.warn('Unknown sample format:', sample);
      return null;
    }
    
    if (sample.date) {
      timestamp = new Date(sample.date);
    } else if (sample.timestamp) {
      timestamp = new Date(sample.timestamp);
    } else {
      console.warn('No timestamp found in sample:', sample);
      return null;
    }
    
    return {
      timestamp,
      value: parseFloat(value),
      units: units || null,
      source: sample.source || null
    };
  } catch (error) {
    console.error('Error normalizing sample:', error, sample);
    return null;
  }
}

function normalizeSleepSample(sample) {
  try {
    return {
      record_date: sample.date ? new Date(sample.date).toISOString().split('T')[0] : null,
      sleep_start: sample.sleepStart ? new Date(sample.sleepStart) : null,
      sleep_end: sample.sleepEnd ? new Date(sample.sleepEnd) : null,
      in_bed_start: sample.inBedStart ? new Date(sample.inBedStart) : null,
      in_bed_end: sample.inBedEnd ? new Date(sample.inBedEnd) : null,
      deep: parseFloat(sample.deep) || 0,
      core: parseFloat(sample.core) || 0,
      rem: parseFloat(sample.rem) || 0,
      awake: parseFloat(sample.awake) || 0,
      total_sleep: parseFloat(sample.totalSleep) || 0,
      source: sample.source || null
    };
  } catch (error) {
    console.error('Error normalizing sleep sample:', error, sample);
    return null;
  }
}

// Database helper functions
async function insertRealtime(client, metricName, data) {
  if (!data || data.length === 0) return 0;
  
  let inserted = 0;
  for (const row of data) {
    try {
      await client.query(`
        INSERT INTO health_realtime (metric_name, timestamp, value)
        VALUES ($1, $2, $3)
        ON CONFLICT ON CONSTRAINT health_realtime_uniq DO UPDATE SET
          value = EXCLUDED.value
      `, [metricName, row.timestamp, row.value]);
      inserted++;
    } catch (error) {
      console.error(`Error inserting realtime data for ${metricName}:`, error.message);
      if (error.code === '25P02') {
        break;
      }
    }
  }
  return inserted;
}

async function insertAggregated(client, metricName, data) {
  if (!data || data.length === 0) return 0;
  
  let inserted = 0;
  for (const row of data) {
    try {
      await client.query(`
        INSERT INTO health_aggregated (metric_name, timestamp, value)
        VALUES ($1, $2, $3)
        ON CONFLICT ON CONSTRAINT health_aggregated_uniq DO UPDATE SET
          value = EXCLUDED.value
      `, [metricName, row.timestamp, row.value]);
      inserted++;
    } catch (error) {
      console.error(`Error inserting aggregated data for ${metricName}:`, error.message);
      if (error.code === '25P02') {
        break;
      }
    }
  }
  return inserted;
}

async function upsertSleep(client, data) {
  if (!data || data.length === 0) return 0;
  
  let inserted = 0;
  for (const row of data) {
    try {
      await client.query(`
        INSERT INTO sleep_analysis (
          record_date, sleep_start, sleep_end, in_bed_start, in_bed_end,
          deep, core, rem, awake
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ON CONSTRAINT sleep_analysis_pk DO UPDATE SET
          sleep_start = EXCLUDED.sleep_start,
          sleep_end = EXCLUDED.sleep_end,
          in_bed_start = EXCLUDED.in_bed_start,
          in_bed_end = EXCLUDED.in_bed_end,
          deep = EXCLUDED.deep,
          core = EXCLUDED.core,
          rem = EXCLUDED.rem,
          awake = EXCLUDED.awake
      `, [
        row.record_date, row.sleep_start, row.sleep_end, 
        row.in_bed_start, row.in_bed_end, row.deep, row.core, 
        row.rem, row.awake
      ]);
      inserted++;
    } catch (error) {
      console.error('Error inserting sleep data:', error.message);
      if (error.code === '25P02') {
        break;
      }
    }
  }
  return inserted;
}

// Health API configuration
const HEALTH_API_BASE = process.env.HEALTH_API_BASE || 'http://127.0.0.1:9876/api';
const HEALTH_API_TOKEN = process.env.HEALTH_API_TOKEN;
const DAYS_BACK = process.env.DAYS_BACK || '7';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/health', healthDataRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api', settingsRoutes);

// Debug: List all registered routes
console.log('Registered routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(`${Object.keys(handler.route.methods)} /api/health-data${handler.route.path}`);
      }
    });
  }
});

// Health data ingestion endpoint
app.post('/api/health/ingest', async (req, res) => {
  try {
    const { start, end } = timeRange(DAYS_BACK);
    console.log(`Fetching health data from ${start} to ${end}`);

    const [
      heart_rate,
      step_count,
      active_energy,
      respiratory_rate,
      apple_exercise_time,
      time_in_daylight,
      headphone_audio_exposure,
      heart_rate_variability,
      apple_sleeping_wrist_temperature,
      sleep_analysis
    ] = await Promise.all([
      fetchMetric('/heart-rate', { start, end }, 'count/min'),
      fetchMetric('/steps', { start, end }, 'count'),
      fetchMetric('/active-energy', { start, end }, 'kcal'),
      fetchMetric('/respiratory-rate', { start, end }, 'count/min'),
      fetchMetric('/exercise-time', { start, end }, 'min'),
      fetchMetric('/time-in-daylight', { start, end }, 'min'),
      fetchMetric('/headphone-audio-exposure', { start, end }, 'dB'),
      fetchMetric('/hrv', { start, end }, 'ms'),
      fetchMetric('/sleeping-wrist-temperature', { start, end }, '°C'),
      fetchSleep('/sleep-analysis', { start, end }),
    ]);

    console.log(`Fetched data counts:`, {
      heart_rate: heart_rate.length,
      step_count: step_count.length,
      active_energy: active_energy.length,
      respiratory_rate: respiratory_rate.length,
      apple_exercise_time: apple_exercise_time.length,
      time_in_daylight: time_in_daylight.length,
      headphone_audio_exposure: headphone_audio_exposure.length,
      heart_rate_variability: heart_rate_variability.length,
      apple_sleeping_wrist_temperature: apple_sleeping_wrist_temperature.length,
      sleep_analysis: sleep_analysis.length
    });

    const client = await pool.connect();
    let inserted = 0;

    try {
      // Realtime metrics
      await client.query('BEGIN');
      inserted += await insertRealtime(client, 'heart_rate', heart_rate);
      inserted += await insertRealtime(client, 'step_count', step_count);
      inserted += await insertRealtime(client, 'active_energy', active_energy);
      inserted += await insertRealtime(client, 'respiratory_rate', respiratory_rate);
      await client.query('COMMIT');

      // Aggregated metrics
      await client.query('BEGIN');
      inserted += await insertAggregated(client, 'apple_exercise_time', apple_exercise_time);
      inserted += await insertAggregated(client, 'time_in_daylight', time_in_daylight);
      inserted += await insertAggregated(client, 'headphone_audio_exposure', headphone_audio_exposure);
      inserted += await insertAggregated(client, 'heart_rate_variability', heart_rate_variability);
      inserted += await insertAggregated(client, 'apple_sleeping_wrist_temperature', apple_sleeping_wrist_temperature);
      await client.query('COMMIT');

      // Sleep analysis
      await client.query('BEGIN');
      inserted += await upsertSleep(client, sleep_analysis);
      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Successfully ingested ${inserted} health data records`,
        inserted,
        timeRange: { start, end }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Health data ingestion failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest health data',
      message: error.message
    });
  }
});

// Get health data summary
app.get('/api/health/summary', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const realtimeCount = await client.query('SELECT COUNT(*) FROM health_realtime');
    const aggregatedCount = await client.query('SELECT COUNT(*) FROM health_aggregated');
    const sleepCount = await client.query('SELECT COUNT(*) FROM sleep_analysis');
    
    client.release();
    
    res.json({
      summary: {
        realtime_records: parseInt(realtimeCount.rows[0].count),
        aggregated_records: parseInt(aggregatedCount.rows[0].count),
        sleep_records: parseInt(sleepCount.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Failed to get health summary:', error);
    res.status(500).json({ error: 'Failed to get health summary' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Data upload endpoint for Apple Watch/Health data
app.post('/api/data', async (req, res) => {
  try {
    console.log('\n=== INCOMING HEALTH DATA ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request body size:', JSON.stringify(req.body).length, 'bytes');
    
    const { data } = req.body;
    
    if (!data || !data.metrics || !Array.isArray(data.metrics)) {
      console.log('❌ Invalid data format');
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid data format - expected data.metrics array' 
      });
    }

    console.log('📊 Metrics received:', data.metrics.length);
    
    // Log each metric type and count
    data.metrics.forEach(metric => {
      console.log(`  - ${metric.name}: ${metric.data?.length || 0} samples (${metric.units || 'no units'})`);
      
      // Show first sample of each metric for debugging
      if (metric.data && metric.data.length > 0) {
        console.log(`    Sample: ${JSON.stringify(metric.data[0])}`);
      }
    });

    const client = await pool.connect();
    let inserted = 0;
    const errors = [];

    try {
      // Process each metric separately with individual transactions
      for (const metric of data.metrics) {
        const { name, units, data: metricData } = metric;
        
        try {
          await client.query('BEGIN');
          
          if (name === 'sleep_analysis') {
            const sleepRows = metricData.map(sample => normalizeSleepSample(sample)).filter(Boolean);
            const count = await upsertSleep(client, sleepRows);
            inserted += count;
            console.log(`💤 Sleep analysis: ${count} records inserted`);
          } else {
            const normalizedRows = metricData.map(sample => normalizeSample(sample, units)).filter(Boolean);
            
            if (['heart_rate', 'step_count', 'active_energy', 'respiratory_rate'].includes(name)) {
              const count = await insertRealtime(client, name, normalizedRows);
              inserted += count;
              console.log(`⚡ ${name} (realtime): ${count} records inserted`);
            } else {
              const count = await insertAggregated(client, name, normalizedRows);
              inserted += count;
              console.log(`📈 ${name} (aggregated): ${count} records inserted`);
            }
          }
          
          await client.query('COMMIT');
        } catch (metricError) {
          await client.query('ROLLBACK');
          console.error(`❌ Error processing ${name}:`, metricError.message);
          errors.push(`${name}: ${metricError.message}`);
        }
      }

      console.log(`✅ Total inserted: ${inserted} health data points`);
      if (errors.length > 0) {
        console.log(`⚠️ Errors encountered:`, errors);
      }
      console.log('=== END HEALTH DATA ===\n');
      
      res.json({ 
        success: true, 
        message: `Successfully processed ${inserted} health data points`,
        inserted,
        errors: errors.length > 0 ? errors : undefined
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Data upload failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to process data upload', message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
