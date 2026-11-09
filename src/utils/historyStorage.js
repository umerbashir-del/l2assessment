const key = 'triageHistory'
const knownCategories = ['Billing Issue', 'Access Problem', 'Technical Problem', 'Feature Request', 'General Inquiry', 'Needs Review', 'Unknown']
const optionalString = (item, key) => item[key] === undefined || typeof item[key] === 'string'
function validRecord(item) {
  return item && typeof item === 'object' && typeof item.message === 'string' &&
    knownCategories.includes(item.category) && ['High', 'Medium', 'Low', 'Needs Review'].includes(item.urgency) &&
    typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp)) &&
    (!('categories' in item) || (Array.isArray(item.categories) && item.categories.length > 0 && item.categories.every(c => knownCategories.includes(c)))) &&
    ['reasoning', 'recommendedAction', 'urgencyExplanation', 'fallbackCode', 'fallbackReason', 'model', 'clarification'].every(k => optionalString(item, k)) &&
    (item.source === undefined || ['ai', 'local'].includes(item.source)) &&
    (item.issues === undefined || (Array.isArray(item.issues) && item.issues.every(issue => issue && typeof issue === 'object' && knownCategories.includes(issue.category) && typeof issue.evidence === 'string'))) &&
    (item.impact === undefined || (item.impact && typeof item.impact === 'object' && !Array.isArray(item.impact) && Object.values(item.impact).every(value => ['yes', 'no', 'unknown'].includes(value))))
}
export function readHistory(storage) {
  try { storage ??= globalThis.localStorage;
    const records = JSON.parse(storage.getItem(key) || '[]')
    if (!Array.isArray(records)) throw new Error('Invalid history')
    const history = records.filter(validRecord)
    const damaged = history.length !== records.length
    return { history, writable: !damaged, warning: damaged ? 'Some saved records are damaged and cannot be displayed. Your stored data has been preserved; new analyses will not be saved until history is cleared.' : '' }
  } catch {
    return { history: [], writable: false, warning: 'Saved history could not be read. Your stored data has been preserved. New analyses will remain on screen but cannot be saved until storage is available or damaged history is cleared.' }
  }
}
export function appendHistory(record, storage) {
  try { storage ??= globalThis.localStorage;
    if (!validRecord(record)) return { ok: false, warning: 'Analysis could not be saved because its data is invalid. Copy the result before leaving.' }
    const loaded = readHistory(storage)
    if (!loaded.writable) return { ok: false, warning: loaded.warning }
    storage.setItem(key, JSON.stringify([...loaded.history, record]))
    return { ok: true, warning: '' }
  } catch {
    return { ok: false, warning: 'Analysis completed, but history could not be saved. Storage may be full or unavailable. Copy your results before leaving this page.' }
  }
}
export function clearSavedHistory(storage) {
  try { storage ??= globalThis.localStorage; storage.removeItem(key); return { ok: true, warning: '' } }
  catch { return { ok: false, warning: 'History could not be cleared because browser storage is unavailable. Please try again.' } }
}



