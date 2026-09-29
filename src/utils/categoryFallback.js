import defaultRules from '../data/categoryRules.json' with { type: 'json' }

const compiledRules = new WeakMap()

function normalize(text) {
  return text.toLowerCase().replace(/[‘’]/g, "'")
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phrasePattern(phrase) {
  const words = phrase.trim().split(/\s+/).map(escapeRegExp)
  return new RegExp(`\\b${words.join('\\s+')}\\b`, 'gi')
}

function compile(rules) {
  if (compiledRules.has(rules)) return compiledRules.get(rules)
  const entries = rules.categories.flatMap(category => [
    ...category.phrases.map(phrase => ({ category: category.name, phrase, failure: false, pattern: phrasePattern(phrase) })),
    ...(category.failurePhrases || []).map(phrase => ({ category: category.name, phrase, failure: true, pattern: phrasePattern(phrase) })),
  ])
  for (const group of rules.subjectStateGroups) {
    for (const subject of group.subjects) {
      for (const state of group.states) {
        const phrase = `${subject} ${state}`
        entries.push({ category: group.category, phrase, failure: false, pattern: phrasePattern(phrase) })
      }
    }
  }
  const result = {
    entries,
    inactive: rules.context.inactivePhrases.map(phrase => ({ phrase, pattern: phrasePattern(phrase) })),
  }
  compiledRules.set(rules, result)
  return result
}

function words(text) {
  return text.match(/[a-z]+(?:'[a-z]+)?/g) || []
}

function localClause(text, index, length) {
  const before = text.slice(0, index)
  const boundary = Math.max(...['.', '!', '?', ';', ','].map(char => before.lastIndexOf(char)))
  const contrast = before.lastIndexOf(' but ')
  const start = Math.max(boundary + 1, contrast < 0 ? 0 : contrast + 5)
  const endMatch = /[.!?;,]/.exec(text.slice(index))
  const end = endMatch ? index + endMatch.index + 1 : text.length
  return { before: text.slice(start, index), after: text.slice(index + length, end), full: text.slice(start, end) }
}

function statusFor(text, match, failure, category, context) {
  const clause = localClause(text, match.index, match[0].length)
  const beforeWords = words(clause.before).slice(-4)
  const afterWords = words(clause.after).slice(0, 5)
  const beforeText = beforeWords.join(' ')
  const afterText = afterWords.join(' ')

  if (context.unresolvedPhrases.some(phrase => afterText.includes(phrase))) return 'active'
  if (context.resolutionPhrases.some(phrase => beforeText.includes(phrase)) ||
      context.resolutionWords.some(word => afterWords.includes(word))) return 'resolved'
  if (!failure && beforeWords.slice(-3).some(word => context.negationWords.includes(word))) return 'negated'
  if (beforeWords.some(word => context.uncertaintyWords.includes(word))) return 'uncertain'

  const trimmed = clause.full.trim()
  const questionStart = context.uncertainQuestionStarts.some(word =>
    new RegExp(`^${escapeRegExp(word)}\\b`).test(trimmed))
  if (category !== 'Feature Request' && trimmed.endsWith('?') && questionStart) return 'uncertain'
  return 'active'
}

/** A deterministic, conservative category when the AI service cannot be used. */
export function categorizeLocally(message, rules = defaultRules) {
  const text = normalize(message).trim()
  const compiled = compile(rules)
  const evidence = []

  for (const entry of compiled.entries) {
    entry.pattern.lastIndex = 0
    for (const match of text.matchAll(entry.pattern)) {
      evidence.push({ category: entry.category, phrase: entry.phrase, status: statusFor(text, match, entry.failure, entry.category, rules.context) })
    }
  }

  const active = evidence.filter(item => item.status === 'active')
  const categories = [...new Set(active.map(item => item.category))]
  const source = 'local'

  if (categories.length > 1) {
    return {
      category: 'Needs Review',
      reasoning: `Local rules found multiple possible categories: ${categories.map(category => `${category} (“${active.find(item => item.category === category).phrase}”)`).join('; ')}. A person should review the full message.`,
      source,
    }
  }

  if (categories.length === 1) {
    const category = categories[0]
    const phrase = active.find(item => item.category === category).phrase
    return {
      category,
      reasoning: `Local rules identified ${category.toLowerCase()} from “${phrase}”. A person should confirm the context before acting.`,
      source,
    }
  }

  if (evidence.length > 0) {
    const uncertain = evidence.some(item => item.status === 'uncertain')
    return {
      category: 'Needs Review',
      reasoning: uncertain
        ? 'Local rules found a possible issue expressed as a question or uncertainty. A person should check whether it is happening.'
        : 'Local rules found issue wording that was denied or resolved. A person should check whether any action is needed.',
      source,
    }
  }

  if (compiled.inactive.some(entry => { entry.pattern.lastIndex = 0; return entry.pattern.test(text) })) {
    return {
      category: 'Needs Review',
      reasoning: 'Local rules found a denied or resolved issue, with no active problem to route.',
      source,
    }
  }

  const informationStart = rules.context.questionStarts.some(word =>
    new RegExp(`^${escapeRegExp(word)}\\b`).test(text))
  if (text.includes('?') || informationStart) {
    return {
      category: 'General Inquiry',
      reasoning: 'Local rules found an information question without a clear reported problem.',
      source,
    }
  }

  return {
    category: 'Needs Review',
    reasoning: 'Local rules found no clear category. A person should review this message.',
    source,
  }
}
