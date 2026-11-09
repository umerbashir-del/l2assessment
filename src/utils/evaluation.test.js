import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { categorizeLocally } from './categoryFallback.js'
const samples=JSON.parse(readFileSync(new URL('../../evaluation/messages.json',import.meta.url)))
for(const sample of samples) test(`fixed evaluation: ${sample.id}`,()=>{
 const result=categorizeLocally(sample.message)
 assert.ok(sample.expected.some(option=>JSON.stringify([...option].sort())===JSON.stringify([...result.categories].sort())),JSON.stringify(result))
})
