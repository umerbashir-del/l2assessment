import test from 'node:test'
import assert from 'node:assert/strict'
import { readHistory, appendHistory, clearSavedHistory } from './historyStorage.js'
const record = {message:'hello', category:'General Inquiry', urgency:'Low', timestamp:'2026-11-09T15:00:00Z'}
function memory(value = null) { return { value, getItem() {return this.value}, setItem(key, next) {this.value=next}, removeItem() {this.value=null} } }
test('valid legacy history loads and appends', () => { const storage=memory(JSON.stringify([record])); assert.equal(appendHistory(record,storage).ok,true); assert.equal(readHistory(storage).history.length,2) })
for (const value of ['broken JSON', '{}', '[null]', JSON.stringify([{...record,categories:42}])]) {
  test(`damaged data is preserved: ${value}`, () => { const storage=memory(value); assert.ok(readHistory(storage).warning); assert.equal(appendHistory(record,storage).ok,false); assert.equal(storage.value,value) })
}
test('partially damaged history shows valid entries without overwriting', () => { const storage=memory(JSON.stringify([record,null])); assert.equal(readHistory(storage).history.length,1); assert.equal(appendHistory(record,storage).ok,false) })
test('quota failure preserves existing history', () => {const storage=memory(JSON.stringify([record])); storage.setItem=()=>{throw Error('quota')}; assert.equal(appendHistory(record,storage).ok,false); assert.equal(readHistory(storage).history.length,1)})
test('blocked storage returns warnings', () => { const storage={getItem(){throw Error()},removeItem(){throw Error()}}; assert.ok(readHistory(storage).warning); assert.equal(clearSavedHistory(storage).ok,false) })
test('explicit clear permits saving again', () => {const storage=memory('bad'); assert.equal(clearSavedHistory(storage).ok,true); assert.equal(appendHistory(record,storage).ok,true)})

for (const fields of [{fallbackReason:{}},{fallbackCode:[]},{source:{}},{reasoning:[]},{urgencyExplanation:{}},{issues:[null]},{issues:[{category:'Access Problem',evidence:{}}]},{impact:[]},{impact:{essentialService:{}}},{categories:['fake']},{urgency:'fake'}]) {
 test(`reject malformed history fields ${JSON.stringify(fields)}`, () => {
  const raw=JSON.stringify([{...record,...fields}]); const storage=memory(raw)
  assert.equal(readHistory(storage).history.length,0)
  assert.ok(readHistory(storage).warning)
  assert.equal(storage.value,raw)
 })
}
test('new malformed records cannot poison history', () => assert.equal(appendHistory({...record,fallbackReason:{}},memory()).ok,false))
