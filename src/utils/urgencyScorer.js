import defaultRules from '../data/urgencyRules.json' with { type: 'json' }

const compiledRules = new WeakMap()

function normalize(text) {
  return text.toLowerCase().replace(/[‘’]/g, "'")
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phrasePattern(phrase) {
  const escapedWords = phrase.trim().split(/\s+/).map(escapeRegExp)
  return new RegExp(`\\b${escapedWords.join('\\s+')}\\b`, 'g')
}

function getCompiledRules(rules) {
  if (compiledRules.has(rules)) return compiledRules.get(rules)

  const compiled = {
    signals: rules.signals.flatMap(signal => [
      ...(signal.phrases || []).map(phrase => ({ signal, phrase, failure: false, pattern: phrasePattern(phrase) })),
      ...(signal.phraseGroups || []).flatMap(group => group.subjects.flatMap(subject =>
        group.links.flatMap(link => group.states.map(state => {
          const phrase = [subject, link, state].filter(Boolean).join(' ')
          return { signal, phrase, failure: false, pattern: phrasePattern(phrase) }
        }))
      )),
      ...(signal.failurePhrases || []).map(phrase => ({ signal, phrase, failure: true, pattern: phrasePattern(phrase) }))
    ]),
    routine: rules.routinePhrases.map(phrasePattern),
    denials: rules.context.denialPhrases.map(phrasePattern)
  }
  compiledRules.set(rules, compiled)
  return compiled
}

function nearbyWords(text, count, fromEnd = false) {
  const words = text.match(/[a-z]+(?:'[a-z]+)?/g) || []
  return fromEnd ? words.slice(-count) : words.slice(0, count)
}

function hasPhrase(text, phrases) {
  return phrases.some(phrase => text.includes(phrase))
}

function contextForMatch(clause, index, length, failure, context) {
  const before = clause.slice(0, index)
  const after = clause.slice(index + length)
  const preceding = nearbyWords(before, 4, true)
  // A denial before a comma should not cancel a new issue after the comma.
  const localPreceding = nearbyWords(before.slice(before.lastIndexOf(',') + 1), 4, true)
  const following = nearbyWords(after, 4)
  const nearText = `${preceding.join(' ')} ${following.join(' ')}`

  // "Not resolved" means the issue is still active, even though it contains "resolved".
  if (hasPhrase(nearText, context.unresolvedPhrases)) return 'active'
  if (context.resolutionWords.some(word => preceding.includes(word) || following.includes(word))) return 'resolved'
  if (!failure && (localPreceding.some(word => context.negationWords.includes(word)) ||
      context.postNegationPhrases.some(phrase => after.trim().startsWith(phrase)))) return 'negated'

  const uncertainPrefix = localPreceding.some(word => context.uncertaintyWords.includes(word))
  const question = clause.trim().endsWith('?') &&
    (/^(?:is|are|could|might|can|do|does|did|has|have|was|were)\b/.test(clause.trim()) ||
      nearbyWords(clause, 20).length <= 4)
  if (!failure && (uncertainPrefix || question)) return 'uncertain'

  return 'active'
}

/** Return the score and evidence so the decision can be inspected and tested. */
export function assessUrgency(message, rules = defaultRules) {
  const text = normalize(message).trim()
  if (!text) return { level: 'Low', score: 0, evidence: [] }

  const compiled = getCompiledRules(rules)
  const contrastWords = rules.context.contrastWords.map(escapeRegExp).join('|')
  const contrastPattern = new RegExp(`\\b(?:${contrastWords})\\b`, 'g')
  const clauses = (text.replace(contrastPattern, '.').match(/[^.!?;\n]+[.!?]?/g) || [])
  const evidence = []
  const activeScores = new Map()

  for (const clause of clauses) {
    for (const entry of compiled.signals) {
      entry.pattern.lastIndex = 0
      for (const match of clause.matchAll(entry.pattern)) {
        const status = contextForMatch(clause, match.index, match[0].length, entry.failure, rules.context)
        evidence.push({ signal: entry.signal.id, phrase: entry.phrase, status })
        if (status === 'active') activeScores.set(entry.signal.id, entry.signal.points)
      }
    }
  }

  const score = [...activeScores.values()].reduce((total, points) => total + points, 0)
  const hasUncertainIssue = evidence.some(item => item.status === 'uncertain')
  const hasDeniedOrResolvedIssue = evidence.some(item => item.status === 'negated' || item.status === 'resolved')
  const hasExplicitDenial = compiled.denials.some(pattern => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })
  const hasRoutinePhrase = compiled.routine.some(pattern => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })

  let level = 'Medium'
  if (score >= rules.thresholds.high) level = 'High'
  else if (score >= rules.thresholds.medium) level = 'Medium'
  else if (!hasUncertainIssue && (hasDeniedOrResolvedIssue || hasExplicitDenial || hasRoutinePhrase ||
    /^(?:hi|hello|hey)[!. ]*$/.test(text) || text.includes('?'))) level = 'Low'

  return { level, score, evidence }
}

export function calculateUrgency(message, rules = defaultRules) {
  return assessUrgency(message, rules).level
}
