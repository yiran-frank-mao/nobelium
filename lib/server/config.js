const fs = require('fs')
const { resolve } = require('path')
const { applyEnvOverrides } = require('./env')

const raw = fs.readFileSync(resolve(process.cwd(), 'blog.config.js'), 'utf-8')
const fileConfig = eval(`((module = { exports }) => { ${raw}; return module.exports })()`)

// `blog.config.js` only holds the defaults: every option can be overridden by
// an environment variable, see `lib/server/env.js`.
const { config, applied: envOverrides } = applyEnvOverrides(fileConfig)

// Options that must not reach the browser, since the whole client config is
// served by `/api/config`.
const PRIVATE_FIELDS = ['notionApiKey', 'notionAccessToken']

const clientConfig = Object.fromEntries(
  Object.entries(config).filter(([key]) => !PRIVATE_FIELDS.includes(key))
)

module.exports = {
  config,
  clientConfig,
  envOverrides
}
