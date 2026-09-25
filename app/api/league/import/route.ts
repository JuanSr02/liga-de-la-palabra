import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const resultPattern = /(?:^|[\s|—–-])([^:|—–-]+?)\s*[:|—–-]\s*([1-6]\/6|X\/6)\b/gi

export async function POST(request: Request) {
  const body = await request.json()
  const adminName = String(body.adminName ?? '').trim().toLowerCase()
  const text = String(body.text ?? '').slice(0, 200_000)
  if (adminName !== 'juan' || !text) return NextResponse.json({ error: 'Solo Juan puede importar resultados.' }, { status: 403 })

  const { rows: players } = await pool.query('SELECT id, name FROM league_players')
  const normalized = new Map(players.map((player) => [player.name.trim().toLowerCase(), player]))
  const matches = [...text.matchAll(resultPattern)]
  const imported: string[] = []
  const skipped: string[] = []
  for (const match of matches) {
    const player = normalized.get(match[1].trim().toLowerCase())
    if (!player) { skipped.push(match[1].trim()); continue }
    const result = match[2].toUpperCase()
    const points = result === 'X/6' ? 7 : Number(result[0])
    try {
      await pool.query('INSERT INTO league_results (player_id, result, points) VALUES ($1, $2, $3) ON CONFLICT (player_id, played_on) DO UPDATE SET result = EXCLUDED.result, points = EXCLUDED.points', [player.id, result, points])
      imported.push(`${player.name}: ${result}`)
    } catch { skipped.push(player.name) }
  }
  return NextResponse.json({ imported, skipped, found: matches.length })
}
