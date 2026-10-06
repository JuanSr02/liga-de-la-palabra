import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const dynamic = 'force-dynamic'
export const revalidate = 0

function response(data: unknown) { return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } }) }

export async function GET() {
  const { rows } = await pool.query(`SELECT p.id, p.name, COUNT(r.id)::int AS games, COALESCE(SUM(r.points), 0)::int AS points, COALESCE(AVG(r.points), 0)::numeric(10,2) AS avg, COUNT(r.id) FILTER (WHERE r.result = '1/6')::int AS wins FROM league_players p LEFT JOIN league_results r ON r.player_id = p.id GROUP BY p.id, p.name ORDER BY points DESC, p.name ASC`)
  const results = await pool.query(`SELECT r.id, r.result, r.points, r.played_on::text AS played_on, r.created_at, p.name FROM league_results r JOIN league_players p ON p.id = r.player_id ORDER BY r.played_on DESC, r.created_at DESC`)
  return response({ players: rows, results: results.rows })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const id = String(body.id ?? '')
  const playerId = String(body.playerId ?? '')
  const adminName = String(body.adminName ?? '').trim().toLowerCase()
  const isAdmin = adminName === 'juan'
  const result = String(body.result ?? '')
  const points = Number(body.points)
  if (!id || !/^([1-6]|X)\/6$/.test(result) || !Number.isInteger(points)) return NextResponse.json({ error: 'Resultado inválido.' }, { status: 400 })
  const { rows } = await pool.query("UPDATE league_results SET result = $1, points = $2 WHERE id = $3 AND player_id = $4 RETURNING id", [result, points, id, playerId, isAdmin])
  return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: 'Registro no encontrado.' }, { status: 404 })
}

export async function POST(request: Request) {
  const body = await request.json()
  const playerId = String(body.playerId ?? '')
  const adminName = String(body.adminName ?? '').trim().toLowerCase()
  const isAdmin = adminName === 'juan'
  const result = String(body.result ?? '')
  const points = Number(body.points)
  if (!playerId || !/^([1-6]|X)\/6$/.test(result) || !Number.isInteger(points) || points < 0) return NextResponse.json({ error: 'Resultado inválido.' }, { status: 400 })
  try {
    const { rows } = await pool.query("INSERT INTO league_results (player_id, result, points, played_on) VALUES ($1, $2, $3, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) RETURNING id", [playerId, result, points])
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'Este jugador ya cargó un resultado hoy.' }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo guardar el resultado.' }, { status: 500 })
  }
}
