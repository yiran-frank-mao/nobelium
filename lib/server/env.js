/**
 * Lets every option of `blog.config.js` be set through an environment
 * variable, so a deployment can be configured without editing (and committing)
 * the config file.
 *
 * The variable of an option is its path inside the config object, upper snake
 * cased and prefixed: `comment.cusdisConfig.appId` is read from
 * `NOBELIUM_COMMENT_CUSDIS_CONFIG_APP_ID`. The prefix keeps options such as
 * `path` and `lang` from colliding with the system's own variables.
 *
 * Values are parsed to match the type of the option in `blog.config.js`:
 * numbers and booleans are converted, arrays accept a comma separated list or
 * a JSON array, and a whole object can be overridden at once with a JSON
 * object, which is merged into the defaults.
 */

const ENV_PREFIX = 'NOBELIUM_'

// Variables that Nobelium read before this mechanism existed. The prefixed
// name takes precedence over these.
const LEGACY_NAMES = new Map([
  ['notionPageId', ['NOTION_PAGE_ID']],
  ['notionApiKey', ['NOTION_API_KEY']],
  ['notionAccessToken', ['NOTION_ACCESS_TOKEN']]
])

const TRUTHY = ['true', '1', 'yes', 'on']
const FALSY = ['false', '0', 'no', 'off', '']

function isPlainObject (value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone (value) {
  if (Array.isArray(value)) return value.map(clone)
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]))
  }
  return value
}

function deepMerge (target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) deepMerge(target[key], value)
    else target[key] = clone(value)
  }
  return target
}

function envNameOf (path) {
  return ENV_PREFIX + path
    .map(key => key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toUpperCase()
    )
    .join('_')
}

function typeOf (value) {
  if (Array.isArray(value)) return 'array'
  if (isPlainObject(value)) return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  // Options left empty in `blog.config.js` (`undefined` or `null`) are treated
  // as strings, which is what every one of them currently is.
  return 'string'
}

/**
 * Flattens a config object into the list of options that can be overridden,
 * parents before their children.
 */
function listConfigOptions (config, path = []) {
  return Object.entries(config).flatMap(([key, value]) => {
    const optionPath = [...path, key]
    const name = optionPath.join('.')
    const option = {
      path: optionPath,
      name,
      envName: envNameOf(optionPath),
      legacyEnvNames: LEGACY_NAMES.get(name) ?? [],
      type: typeOf(value),
      value
    }
    return option.type === 'object'
      ? [option, ...listConfigOptions(value, optionPath)]
      : [option]
  })
}

function parseValue (raw, option) {
  const value = raw.trim()
  switch (option.type) {
    case 'boolean':
      if (TRUTHY.includes(value.toLowerCase())) return true
      if (FALSY.includes(value.toLowerCase())) return false
      throw new Error(`${option.envName} must be a boolean, got '${raw}'`)
    case 'number': {
      // An empty value keeps the "leave it empty" behaviour of the config file.
      if (value === '') return ''
      const number = Number(value)
      if (Number.isNaN(number)) throw new Error(`${option.envName} must be a number, got '${raw}'`)
      return number
    }
    case 'array': {
      if (value === '') return []
      if (value.startsWith('[')) {
        const parsed = parseJson(value, option, 'a JSON array')
        if (!Array.isArray(parsed)) throw new Error(`${option.envName} must be a JSON array, got '${raw}'`)
        return parsed
      }
      return value.split(',').map(item => item.trim()).filter(Boolean)
    }
    case 'object': {
      if (value === '') return {}
      const parsed = parseJson(value, option, 'a JSON object')
      if (!isPlainObject(parsed)) throw new Error(`${option.envName} must be a JSON object, got '${raw}'`)
      return parsed
    }
    default:
      // Strings are taken verbatim: whitespace may be meaningful.
      return raw
  }
}

function parseJson (value, option, expected) {
  try {
    return JSON.parse(value)
  } catch (err) {
    throw new Error(`${option.envName} must be ${expected}, got '${value}' (${err.message})`)
  }
}

function readEnv (option, env) {
  for (const name of [option.envName, ...option.legacyEnvNames]) {
    const raw = env[name]
    if (raw !== undefined) return { name, raw }
  }
  return undefined
}

function valueAt (config, path) {
  return path.reduce((value, key) => value[key], config)
}

/**
 * Returns a copy of `config` with every option that has a matching environment
 * variable replaced by its value.
 */
function applyEnvOverrides (config, env = process.env) {
  const result = clone(config)
  const options = listConfigOptions(result)
  const applied = []

  for (const option of options) {
    const found = readEnv(option, env)
    if (!found) continue
    const value = parseValue(found.raw, option)
    const parent = valueAt(result, option.path.slice(0, -1))
    const key = option.path[option.path.length - 1]
    // Objects are merged so that a JSON override only has to list the keys it
    // changes; options nested in it are applied afterwards and win.
    if (option.type === 'object' && isPlainObject(parent[key])) deepMerge(parent[key], value)
    else parent[key] = value
    applied.push({ name: option.name, envName: found.name })
  }

  warnAboutUnknownVariables(options, env)

  return { config: result, applied }
}

function warnAboutUnknownVariables (options, env) {
  const known = new Set(options.flatMap(option => [option.envName, ...option.legacyEnvNames]))
  const unknown = Object.keys(env).filter(name => name.startsWith(ENV_PREFIX) && !known.has(name))
  if (unknown.length) {
    console.warn(
      `[nobelium] Ignoring unknown config environment variable(s): ${unknown.join(', ')}. ` +
      'See the "Configure with environment variables" section of the README for the supported names.'
    )
  }
}

module.exports = {
  ENV_PREFIX,
  applyEnvOverrides,
  envNameOf,
  listConfigOptions
}
