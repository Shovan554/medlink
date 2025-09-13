import doctorRoutes from './routes/doctor.js';
import trendsRoutes from './routes/trends.js';

// Add this with your other route imports
app.use('/api/doctor', doctorRoutes);
app.use('/api/trends', trendsRoutes);
