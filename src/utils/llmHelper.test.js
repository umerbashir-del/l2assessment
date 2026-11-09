import test from 'node:test'
import assert from 'node:assert/strict'
import { categorizeMessage } from './llmHelper.js'
for (const code of ['missing_configuration','network','timeout','invalid_result','authentication','model_unavailable','rate_limit','provider_unavailable']) {
 test(`explains ${code}`, async () => {
  const result = await categorizeMessage('My payment failed.', async () => ({ok:false,status:503,json:async()=>({code})}))
  assert.equal(result.source,'local'); assert.equal(result.fallbackCode,code); assert.ok(result.fallbackReason)
 })
}
test('network failure differs from invalid output', async () => {
 const offline = await categorizeMessage('Hello', async()=>{throw new TypeError('network')})
 const invalid = await categorizeMessage('Hello', async()=>({ok:true,json:async()=>({})}))
 assert.equal(offline.fallbackCode,'backend_unavailable'); assert.equal(invalid.fallbackCode,'invalid_result')
})
test('timeout explanation', async()=>{
 const result=await categorizeMessage('Hello',async()=>{throw Object.assign(new Error(),{name:'TimeoutError'})})
 assert.equal(result.fallbackCode,'timeout')
})

