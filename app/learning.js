import words from './words.json'

export const SECTION_SIZE = 20
export const REVIEW_GAP = 3
export const initialProgress = { goal: 5, step: 0, words: {} }

export function dateKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-')
}

function inDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export function dueWords(progress, date = dateKey()) {
  return Object.keys(progress.words).map(Number)
    .filter(id => progress.words[id].due <= date)
    .sort((a, b) => progress.words[a].ready - progress.words[b].ready)
}

export function nextWord(progress, section, previous = -1) {
  const due = dueWords(progress)
  const review = due.find(id => id !== previous && progress.words[id].ready <= progress.step)
  if (review !== undefined && progress.step % 2 === 1) return review
  const start = section * SECTION_SIZE
  const fresh = words.findIndex((_, id) => id >= start && id !== previous && !progress.words[id]?.first)
  if (fresh >= 0) return fresh
  const earlier = words.findIndex((_, id) => id !== previous && !progress.words[id]?.first)
  if (earlier >= 0) return earlier
  return review ?? due.find(id => id !== previous) ?? (previous + 1) % words.length
}

export function record(progress, id, correct, countNew = true) {
  const today = dateKey()
  const old = progress.words[id]
  const step = progress.step + 1
  const level = correct ? Math.min((old?.level ?? 0) + 1, 5) : 0
  return {
    ...progress,
    step,
    words: {
      ...progress.words,
      [id]: {
        first: old?.first ?? (countNew ? today : null),
        level,
        due: correct ? inDays([0, 1, 3, 7, 14, 30][level]) : today,
        ready: correct ? step : step + REVIEW_GAP,
      },
    },
  }
}
