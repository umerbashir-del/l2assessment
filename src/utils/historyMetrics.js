const millisecondsPerDay = 24 * 60 * 60 * 1000

function localCalendarDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / millisecondsPerDay
}

export function sortHistoryNewestFirst(history) {
  return [...history].sort((a, b) =>
    (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
  )
}

export function calculateAveragePerDay(history, now = new Date()) {
  const today = localCalendarDay(now)
  const analysisDays = history
    .map(item => localCalendarDay(new Date(item.timestamp)))
    .filter(day => Number.isFinite(day) && day <= today)

  if (analysisDays.length === 0) return 0

  const daysSinceFirstAnalysis = today - Math.min(...analysisDays) + 1
  return Number((analysisDays.length / daysSinceFirstAnalysis).toFixed(1))
}
