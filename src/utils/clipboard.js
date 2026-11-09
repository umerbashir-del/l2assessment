export async function copyResults(text, clipboard = globalThis.navigator?.clipboard) {
  try {
    if (!clipboard?.writeText) throw new Error('Unavailable')
    await clipboard.writeText(text)
    return { ok: true, message: 'Results copied to clipboard.' }
  } catch {
    return { ok: false, message: 'Could not copy results. Select the results and copy them manually, or allow clipboard access and try again.' }
  }
}
