import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const hashSecret = (secret: string) => createHash('sha256').update(secret.trim().toLowerCase()).digest('hex')

export async function GET() {
  const { rows } = await pool.query('SELECT id, name, created_at FROM league_players ORDER BY name ASC')
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const body = await request.json()
  const name = String(body.name ?? '').trim()
  const secret = String(body.secret ?? '').trim()
  if (name.length < 2 || secret.length < 2 || name.length > 40 || secret.length > 80) {
    return NextResponse.json({ error: 'Nombre y palabra secreta son obligatorios.' }, { status: 400 })
  }
  try {
    const { rows } = await pool.query('INSERT INTO league_players (name, secret) VALUES ($1, $2) RETURNING id, name, created_at', [name, hashSecret(secret)])
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) return NextResponse.json({ error: 'Ese jugador ya existe.' }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo guardar el jugador.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const body = await request.json()
  const id = String(body.id ?? '')
  await pool.query('DELETE FROM league_players WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
