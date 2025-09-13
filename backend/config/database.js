import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'shovan',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medlink', 
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

export default pool;
