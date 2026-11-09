import process from 'node:process'
import { readFileSync, writeFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import { requestClassification } from './classifier.js'
import { categorizeLocally } from '../src/utils/categoryFallback.js'
const cases = JSON.parse(readFileSync(new URL('../evaluation/messages.json', import.meta.url)))
const live = process.argv.includes('--live')
const env = live ? loadEnv('development', process.cwd(), 'GROQ_') : {}
const matches = (actual, expected) => expected.some(option => JSON.stringify([...option].sort()) === JSON.stringify([...actual].sort()))
const report = []
for (const sample of cases) {
 const local = categorizeLocally(sample.message)
 const row = { ...sample, local: { categories: local.categories, pass: matches(local.categories,sample.expected) } }
 if(live) {
  try {
   const result = await requestClassification(sample.message,env.GROQ_API_KEY)
   row.ai = { categories: result.categories, pass: matches(result.categories,sample.expected), source: 'ai' }
  } catch(error) {
   row.ai = { code: error.code, validationReason: error.validationReason, source: 'rejected_or_unavailable' }
   row.fallback = { categories: local.categories, pass: row.local.pass, source: 'local' }
  }
 }
 report.push(row)
 console.log(JSON.stringify(row))
}
writeFileSync(new URL(live ? '../evaluation/live-results.json' : '../evaluation/local-results.json', import.meta.url),JSON.stringify(report,null,2)+'\n')
const localPass=report.filter(row=>row.local.pass).length
console.log(`Local exact/accepted matches: ${localPass}/${report.length}`)
if(live) console.log(`AI accepted matches: ${report.filter(row=>row.ai.pass).length}; AI mismatches: ${report.filter(row=>row.ai.pass===false).length}; rejected/unavailable: ${report.filter(row=>row.ai.source!=='ai').length}`)
if(localPass !== report.length || report.some(row=>row.ai?.pass===false)) process.exitCode=1
