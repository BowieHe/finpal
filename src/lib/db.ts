import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://finpal:finpal@localhost:5432/finpal';

const pool = new Pool({
  connectionString: databaseUrl,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = () => pool.connect();

export default pool;
