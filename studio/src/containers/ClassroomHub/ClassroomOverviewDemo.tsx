import { Tooltip } from "@/components/ui/Tooltip"
import { cn } from "@/lib/utils"

export type PresenceTone = "dormant" | "away" | "active" | "ai_light" | "ai_heavy"

const TONE_LABEL: Record<PresenceTone, string> = {
  dormant: "Away from PAD",
  away: "No activity ~30m",
  active: "Working in PAD",
  ai_light: "Asking the tutor (AI)",
  ai_heavy: "Heavy AI back-and-forth",
}

/** Skews toward “in class” greens so the wall reads calm and even; a few tutor pings and rare idle. */
function toneFromSeed(seed: string): PresenceTone {
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 3)) % 997
  const r = n % 100
  if (r < 62) return "active"
  if (r < 78) return "ai_light"
  if (r < 88) return "away"
  if (r < 96) return "dormant"
  return "ai_heavy"
}

function shortLabel(userId: string, index: number): string {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase()
  if (tail.length >= 2) return tail
  return `S${index + 1}`
}

type Tile = { key: string; seed: string; label: string }

/** Placeholder roster grid — numeric codes only (no names). */
const FALLBACK_DEMO: Tile[] = Array.from({ length: 40 }, (_, i) => ({
  key: `d-${i + 1}`,
  seed: `seat-${i + 1}-${((i * 17) % 93).toString(36)}`,
  label: `${(i + 1).toString().padStart(2, "0")}`,
}))

const MIN_PRESENCE_TILES = 32

const DEMO_INQUIRIES: { id: string; text: string; ago: string }[] = [
  {
    id: "q1",
    text: "wait is the hypotenuse ALWAYS the longest side or only when theres a rt angle?? im messed up on #4",
    ago: "now",
  },
  {
    id: "q2",
    text: "tbh idk which letter is c in a²+b²=c² if the 90° is at A… i labeled hyp wrong i think",
    ago: "2m",
  },
  {
    id: "q3",
    text: "hypotenuse = slanted side only?? mine looks slanted but its NOT the longest bc i drew it weird lol",
    ago: "4m",
  },
  {
    id: "q4",
    text: "can u just tell me if hyp is opp the right angle or nah i keep mixing w/ legs",
    ago: "7m",
  },
  {
    id: "q5",
    text: "for a 3-4-5 triangle which one is def the hyp pls i put 3 and got roasted",
    ago: "11m",
  },
  {
    id: "q6",
    text: "ws says ‘identify the hypotenuse’ — do i circle the whole side or just write the letter",
    ago: "14m",
  },
]

export function buildPresenceTiles(
  members: ReadonlyArray<{ id: string; userId: string }>
): Tile[] {
  if (members.length === 0) {
    return FALLBACK_DEMO.slice(0, MIN_PRESENCE_TILES)
  }
  const fromRoster: Tile[] = members.map((m, i) => ({
    key: m.id,
    seed: m.userId,
    label: shortLabel(m.userId, i),
  }))
  if (fromRoster.length >= MIN_PRESENCE_TILES) {
    return fromRoster.slice(0, MIN_PRESENCE_TILES)
  }
  const usedSeeds = new Set(fromRoster.map((t) => t.seed))
  const fillers: Tile[] = []
  let i = 0
  for (const d of FALLBACK_DEMO) {
    if (fromRoster.length + fillers.length >= MIN_PRESENCE_TILES) break
    const seed = usedSeeds.has(d.seed) ? `${d.seed}-pad-${i}` : d.seed
    usedSeeds.add(seed)
    fillers.push({
      key: `fill-${d.key}-${i}`,
      seed,
      label: d.label,
    })
    i++
  }
  return [...fromRoster, ...fillers].slice(0, MIN_PRESENCE_TILES)
}

export function ClassroomPresenceGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="classroom-hub__presence-grid" role="list" aria-label="Student presence">
      {tiles.map((t) => {
        const tone = toneFromSeed(t.seed)
        return (
          <Tooltip
            key={t.key}
            label={`${t.label} — ${TONE_LABEL[tone]}`}
            className="classroom-hub__presence-tooltip-wrap"
          >
            <button
              type="button"
              role="listitem"
              className={cn("classroom-hub__presence-tile", `classroom-hub__presence-tile--${tone}`)}
              aria-label={`${t.label}, ${TONE_LABEL[tone]}`}
            >
              <span className="classroom-hub__presence-tile__abbr" aria-hidden>
                {t.label.slice(0, 2)}
              </span>
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function ClassroomInquiriesDemo() {
  return (
    <ul className="classroom-hub__inquiry-list">
      {DEMO_INQUIRIES.map((q) => (
        <li key={q.id} className="classroom-hub__inquiry">
          <div className="classroom-hub__inquiry__meta">
            <span className="classroom-hub__inquiry__ago">{q.ago}</span>
          </div>
          <p className="classroom-hub__inquiry__text">{q.text}</p>
        </li>
      ))}
    </ul>
  )
}

export function ClassroomPresenceLegend() {
  const items: { tone: PresenceTone; text: string }[] = [
    { tone: "dormant", text: "Away from PAD" },
    { tone: "away", text: "Idle ~30m" },
    { tone: "active", text: "In PAD" },
    { tone: "ai_light", text: "AI question" },
    { tone: "ai_heavy", text: "Heavy AI" },
  ]
  return (
    <div className="classroom-hub__legend" aria-label="Presence legend">
      {items.map((row) => (
        <div key={row.tone} className="classroom-hub__legend-row">
          <span
            className={cn("classroom-hub__legend-swatch", `classroom-hub__presence-tile--${row.tone}`)}
            aria-hidden
          />
          <span className="classroom-hub__legend-text">{row.text}</span>
        </div>
      ))}
    </div>
  )
}
