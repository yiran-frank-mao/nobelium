const assert = require('node:assert/strict')
const { afterEach, describe, it } = require('node:test')

const dayjs = require('dayjs')
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))

const { resolveTimezone } = require('../lib/timezone')

function withoutWarnings (fn) {
  const warn = console.warn
  console.warn = () => {}
  try { return fn() } finally { console.warn = warn }
}

describe('resolveTimezone', () => {
  it('keeps a timezone the runtime knows', () => {
    assert.equal(resolveTimezone('Australia/Canberra'), 'Australia/Canberra')
    assert.equal(resolveTimezone('Asia/Shanghai'), 'Asia/Shanghai')
  })

  it('trims a value that carries whitespace', () => {
    assert.equal(resolveTimezone(' Australia/Canberra\r\n'), 'Australia/Canberra')
  })

  it('falls back to the system timezone when the value is unusable', () => {
    for (const value of [undefined, null, '', ' ', 'Mars/Olympus', "'Australia/Canberra'"]) {
      assert.equal(withoutWarnings(() => resolveTimezone(value)), undefined, String(value))
    }
  })

  it('warns once per unknown timezone', () => {
    const warnings = []
    const warn = console.warn
    console.warn = message => warnings.push(message)
    try {
      resolveTimezone('Mars/Phobos')
      resolveTimezone('Mars/Phobos')
    } finally {
      console.warn = warn
    }
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /Unknown timezone 'Mars\/Phobos'/)
  })
})

describe('dayjs default timezone', () => {
  afterEach(() => dayjs.tz.setDefault(undefined))

  it('interprets a date in the configured timezone', () => {
    dayjs.tz.setDefault(resolveTimezone('Australia/Canberra'))
    assert.equal(dayjs.tz('2024-03-01').format(), '2024-03-01T00:00:00+11:00')
  })

  it('does not throw for a value pasted with its quotes', () => {
    // Setting the raw value is what broke every page of the Vercel build with
    // `RangeError: Invalid time zone specified: 'Australia/Canberra'`.
    dayjs.tz.setDefault("'Australia/Canberra'")
    assert.throws(() => dayjs.tz('2024-03-01'), /Invalid time zone specified/)

    dayjs.tz.setDefault(withoutWarnings(() => resolveTimezone("'Australia/Canberra'")))
    assert.doesNotThrow(() => dayjs.tz('2024-03-01'))
  })
})
