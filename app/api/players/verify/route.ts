import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const hashSecret = (secret: string) => createHash('sha256').update(secret.trim().toLowerCase()).digest('hex')

export async function POST(request: Request) {
  const { name, secret } = await request.json()
  const { rowCount } = await pool.query('SELECT id FROM league_players WHERE name = $1 AND secret = $2', [String(name), hashSecret(String(secret ?? ''))])
  return NextResponse.json({ valid: rowCount === 1 }, { status: rowCount === 1 ? 200 : 401 })
}
