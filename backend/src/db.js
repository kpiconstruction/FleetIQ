const dotenv = require('dotenv');
dotenv.config();

const mysql = require('mysql2/promise');

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || '3306');
const database = process.env.DB_NAME || '';
const user = process.env.DB_USER || '';
const password = process.env.DB_PASSWORD || '';

const pool = mysql.createPool({
  host,
  port,
  database,
  user,
  password,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = { pool, query };
