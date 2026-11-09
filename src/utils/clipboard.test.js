import test from 'node:test'
import assert from 'node:assert/strict'
import { copyResults } from './clipboard.js'
test('success waits for clipboard completion', async () => {
 let finish; let completed=false
 const pending=copyResults('example',{writeText:()=>new Promise(resolve=>{finish=resolve})}).then(result=>{completed=true;return result})
 await Promise.resolve(); assert.equal(completed,false)
 finish(); assert.equal((await pending).ok,true)
})
test('denied clipboard shows failure',async()=>assert.equal((await copyResults('example',{writeText:async()=>{throw Error('denied')}})).ok,false))
test('unavailable clipboard shows failure',async()=>assert.equal((await copyResults('example',{})).ok,false))
