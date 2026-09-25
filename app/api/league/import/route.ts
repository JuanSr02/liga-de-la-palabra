import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const resultPattern = /La palabra del día(?:\s+#\d+)?\s+([1-6X])\/6\b/i
const spanishMonths: Record<string, number> = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 }
function parseChatDate(value: string) { const match = value.match(/^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i); if (!match) return null; const month = spanishMonths[match[2].toLowerCase()]; return month === undefined ? null : `${match[3]}-${String(month + 1).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}` }
function parseWhatsAppDate(value: string) { const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/); if (!match) return null; const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]); return `${year}-${String(Number(match[1])).padStart(2, '0')}-${String(Number(match[2])).padStart(2, '0')}` }
function normalizeSender(sender: string) { const clean = sender.replace(/^\*|\*$/g, '').trim().toLowerCase(); return clean === 'tú' || clean === 'tu' ? 'juan' : clean }
function normalizeName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase() }
function resolvePlayer(sender: string, players: { id: string; name: string }[]) { const senderName = normalizeName(sender); const exact = players.find((player) => normalizeName(player.name) === senderName); if (exact) return exact; const senderParts = senderName.split(' '); const candidates = players.filter((player) => { const playerName = normalizeName(player.name); const playerParts = playerName.split(' '); const lastName = playerParts[playerParts.length - 1]; return senderParts.includes(playerName) || senderParts.includes(lastName) || senderParts[senderParts.length - 1] === lastName }); return candidates.length === 1 ? candidates[0] : null }
function parseWhatsApp(text: string) { let playedOn: string | null = null; const entries: { sender: string; result: string; playedOn: string | null }[] = []; for (const line of text.split(/\r?\n/)) { const date = line.match(/^##\s+(\d{1,2} de [^#]+? de \d{4})\s*$/i); if (date) { playedOn = parseChatDate(date[1].trim()); continue } if (line.trimStart().startsWith('>')) continue; const whatsappHeader = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*\d{1,2}:\d{2}:\d{2}\s*[AP]M\]\s*([^:]+):\s*(.*)$/i); const markdownHeader = line.match(/^\[\d{1,2}:\d{2}\]\s+\*\*([^*]+)\*\*:\s*(.*)$/); const sender = whatsappHeader?.[2] ?? markdownHeader?.[1]; const message = whatsappHeader?.[3] ?? markdownHeader?.[2]; if (!sender || !message) continue; const result = message.match(resultPattern); if (result) { const messageDate = whatsappHeader ? parseWhatsAppDate(whatsappHeader[1]) : playedOn; entries.push({ sender: normalizeSender(sender), result: `${result[1].toUpperCase()}/6`, playedOn: messageDate }) } } return { playedOn, entries } }

export async function POST(request: Request) {
  const body = await request.json()
  const adminName = String(body.adminName ?? '').trim().toLowerCase()
  const text = String(body.text ?? '').slice(0, 200_000)
  if (adminName !== 'juan' || !text) return NextResponse.json({ error: 'Solo Juan puede importar resultados.' }, { status: 403 })

  const { rows: players } = await pool.query('SELECT id, name FROM league_players')
  const parsed = parseWhatsApp(text)
  const fallbackDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
  const playedOn = parsed.playedOn ?? fallbackDate
  const imported: string[] = []
  const skipped: string[] = []
  const latestByPlayer = new Map<string, { sender: string; result: string; playedOn: string | null }>()
  for (const entry of parsed.entries) latestByPlayer.set(entry.sender, entry)
  for (const entry of latestByPlayer.values()) {
    const player = resolvePlayer(entry.sender, players)
    if (!player) { skipped.push(entry.sender); continue }
    const points = entry.result === 'X/6' ? 7 : Number(entry.result[0])
    try {
      await pool.query('INSERT INTO league_results (player_id, result, points, played_on) VALUES ($1, $2, $3, $4) ON CONFLICT (player_id, played_on) DO UPDATE SET result = EXCLUDED.result, points = EXCLUDED.points', [player.id, entry.result, points, entry.playedOn ?? playedOn])
      imported.push(`${player.name}: ${entry.result}`)
    } catch { skipped.push(player.name) }
  }
  return NextResponse.json({ imported, skipped, found: parsed.entries.length, playedOn })
}
