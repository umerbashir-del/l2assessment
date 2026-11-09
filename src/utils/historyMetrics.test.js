import test from 'node:test'
import assert from 'node:assert/strict'
import { sortHistoryNewestFirst, calculateAveragePerDay } from './historyMetrics.js'

test('history sorts by timestamp despite leading quotation marks', () => {
  const older = { message: '“Server down now”', timestamp: '2026-09-29T04:08:00.000Z' }
  const middle = { message: 'AAA history check', timestamp: '2026-09-29T04:20:00.000Z' }
  const newer = { message: 'ZZZ history check', timestamp: '2026-09-29T04:21:00.000Z' }

  assert.deepEqual(sortHistoryNewestFirst([older, middle, newer]), [newer, middle, older])
})

test('average uses calendar days since the first analysis', () => {
  const now = new Date(2026, 8, 29, 12)
  const today = { timestamp: new Date(2026, 8, 29, 9).toISOString() }
  const twoDaysAgo = { timestamp: new Date(2026, 8, 27, 9).toISOString() }

  assert.equal(calculateAveragePerDay([], now), 0)
  assert.equal(calculateAveragePerDay([today, today, today], now), 3)
  assert.equal(calculateAveragePerDay([twoDaysAgo, today], now), 0.7)
  assert.equal(calculateAveragePerDay([{ timestamp: 'invalid' }, today], now), 1)
})
