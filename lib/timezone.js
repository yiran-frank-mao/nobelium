const warned = new Set()

/**
 * Returns `timezone` when the runtime knows it, `undefined` otherwise, so that
 * an unusable value falls back to the system timezone instead of throwing a
 * `RangeError` from every date it touches — which, during a build, means every
 * page failing to prerender.
 */
function resolveTimezone (timezone) {
  const name = typeof timezone === 'string' ? timezone.trim() : ''
  if (!name) return undefined

  try {
    Intl.DateTimeFormat('en-US', { timeZone: name })
    return name
  } catch {
    if (!warned.has(name)) {
      warned.add(name)
      console.warn(
        `[nobelium] Unknown timezone '${name}', using ${Intl.DateTimeFormat().resolvedOptions().timeZone} instead. ` +
        'See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for the valid names.'
      )
    }
    return undefined
  }
}

module.exports = { resolveTimezone }
