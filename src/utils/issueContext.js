export const normalizeEvidence = text => text.normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

const followsPriorIssue = text => /^\s*(?:it(?:'s| is| was| has been)?|its|that(?:'s| is| was)?|this(?: is| was)?)\b/.test(text)
function deniedOrResolved(text) {
  const context = text
    .replace(/\b(?:not|never)\s+(?:yet\s+)?(?:resolved|fixed|restored)\b/g, '')
    .replace(/\bno longer\s+(?:works?|working|loads?|loading|opens?|opening|available|accessible)\b/g, '')
  return /\b(?:resolved|fixed|restored|working again|works now|now works|working now|is fine now|no longer)\b/.test(context) ||
    /\bno\s+(?:billing\s+issue|payment\s+(?:issue|problem|failure)|access\s+problem|technical\s+(?:issue|problem)|trouble\s+logging\s+in|problem\s+with\s+billing)\b|\b(?:not|never)\s+(?:(?:being|getting)\s+)?(?:down|broken|failed|failing|declined|charged|locked out)\b|\b(?:did not|didn't|does not|doesn't)\s+fail\b/.test(context)
}

export function evidenceContext(message, evidence) {
  const text = normalizeEvidence(message)
  const quote = normalizeEvidence(evidence).replace(/[.!?;]+$/, '')
  if (!quote) return { active: false, uncertain: false }
  const sentences = [...text.matchAll(/[^.!?;]+[.!?;]*/g)]
  const contexts = []
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i][0]
    let occurrence = sentence.indexOf(quote)
    while (occurrence !== -1) {
      const parts = [...sentence.matchAll(/(?:^|\b(?:and|but|however|while|although)\b)([\s\S]*?)(?=\b(?:and|but|however|while|although)\b|$)/g)]
      const overlapping = parts.map((part, index) => ({part,index})).filter(({part}) => part.index < occurrence + quote.length && part.index + part[0].length > occurrence)
      let context = overlapping.map(({part}) => part[1]).join(' ')
      const last = overlapping.at(-1)?.index
      if (last !== undefined && parts[last + 1] && followsPriorIssue(parts[last + 1][1])) context += ' ' + parts[last + 1][1]
      if (last === parts.length - 1 && sentences[i + 1] && followsPriorIssue(sentences[i + 1][0])) context += ' ' + sentences[i + 1][0]
      contexts.push(context || sentence)
      occurrence = sentence.indexOf(quote, occurrence + quote.length)
    }
  }
  return {
    active: contexts.length > 0 && contexts.every(context => !deniedOrResolved(context)),
    uncertain: contexts.some(context => /\b(?:maybe|might|possibly|perhaps|not sure|i think|is there|could there)\b/.test(context)),
  }
}

