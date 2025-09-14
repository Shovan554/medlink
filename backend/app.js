import doctorRoutes from './routes/doctor.js';
import trendsRoutes from './routes/trends.js';
import suspectedRoutes from './routes/suspected.js';

// Add this with your other route imports
app.use('/api/doctor', doctorRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/suspected', suspectedRoutes);
