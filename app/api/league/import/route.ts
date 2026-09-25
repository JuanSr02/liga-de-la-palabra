import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const resultPattern = /La palabra del día(?:\s+#\d+)?\s+([1-6X])\/6\b/i
const spanishMonths: Record<string, number> = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 }
function parseChatDate(value: string) { const match = value.match(/^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i); if (!match) return null; const month = spanishMonths[match[2].toLowerCase()]; return month === undefined ? null : `${match[3]}-${String(month + 1).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}` }
function normalizeSender(sender: string) { return sender.replace(/^\*|\*$/g, '').trim().toLowerCase() === 'tú' ? 'juan' : sender.replace(/^\*|\*$/g, '').trim().toLowerCase() }
function parseWhatsApp(text: string) { let playedOn: string | null = null; const entries: { sender: string; result: string }[] = []; for (const line of text.split(/\r?\n/)) { const date = line.match(/^##\s+(\d{1,2} de [^#]+? de \d{4})\s*$/i); if (date) { playedOn = parseChatDate(date[1].trim()); continue } if (line.trimStart().startsWith('>')) continue; const header = line.match(/^\[\d{1,2}:\d{2}\]\s+\*\*([^*]+)\*\*:\s*(.*)$/); if (!header) continue; const result = header[2].match(resultPattern); if (result) entries.push({ sender: normalizeSender(header[1]), result: `${result[1].toUpperCase()}/6` }) } return { playedOn, entries } }

export async function POST(request: Request) {
  const body = await request.json()
  const adminName = String(body.adminName ?? '').trim().toLowerCase()
  const text = String(body.text ?? '').slice(0, 200_000)
  if (adminName !== 'juan' || !text) return NextResponse.json({ error: 'Solo Juan puede importar resultados.' }, { status: 403 })

  const { rows: players } = await pool.query('SELECT id, name FROM league_players')
  const normalized = new Map(players.map((player) => [player.name.trim().toLowerCase(), player]))
  const parsed = parseWhatsApp(text)
  const fallbackDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
  const playedOn = parsed.playedOn ?? fallbackDate
  const imported: string[] = []
  const skipped: string[] = []
  const latestByPlayer = new Map<string, { sender: string; result: string }>()
  for (const entry of parsed.entries) latestByPlayer.set(entry.sender, entry)
  for (const entry of latestByPlayer.values()) {
    const player = normalized.get(entry.sender)
    if (!player) { skipped.push(entry.sender); continue }
    const points = entry.result === 'X/6' ? 7 : Number(entry.result[0])
    try {
      await pool.query('INSERT INTO league_results (player_id, result, points, played_on) VALUES ($1, $2, $3, $4) ON CONFLICT (player_id, played_on) DO UPDATE SET result = EXCLUDED.result, points = EXCLUDED.points', [player.id, entry.result, points, playedOn])
      imported.push(`${player.name}: ${entry.result}`)
    } catch { skipped.push(player.name) }
  }
  return NextResponse.json({ imported, skipped, found: parsed.entries.length, playedOn })
}
