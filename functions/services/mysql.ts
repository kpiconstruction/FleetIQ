import mysql from 'npm:mysql2/promise';

const host = Deno.env.get('DB_HOST') || 'localhost';
const port = Number(Deno.env.get('DB_PORT') || '3306');
const database = Deno.env.get('DB_NAME') || '';
const user = Deno.env.get('DB_USER') || '';
const password = Deno.env.get('DB_PASSWORD') || '';

export const pool = mysql.createPool({ host, port, database, user, password, waitForConnections: true, connectionLimit: 10 });

export async function query(sql: string, params: any[] = []) {
  const [rows] = await pool.query(sql, params);
  return rows as any[];
}

export async function exec(sql: string) {
  await pool.query(sql);
}
