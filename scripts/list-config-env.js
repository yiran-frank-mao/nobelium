#!/usr/bin/env node
/**
 * Prints the environment variable of every option in `blog.config.js`, next to
 * the value currently in effect. Run it with `pnpm run config:env`.
 */

const { listConfigOptions } = require('../lib/server/env')
const { config, envOverrides } = require('../lib/server/config')

const SECRETS = ['notionApiKey', 'notionAccessToken', 'comment.gitalkConfig.clientSecret']

const overridden = new Set(envOverrides.map(override => override.name))

function format (option) {
  if (option.type === 'object') return ''
  if (SECRETS.includes(option.name) && option.value) return '<hidden>'
  return JSON.stringify(option.value) ?? ''
}

const rows = listConfigOptions(config).map(option => [
  option.envName,
  option.type,
  format(option),
  overridden.has(option.name) ? '(from env)' : ''
])

const widths = rows[0].map((_, column) => Math.max(...rows.map(row => row[column].length)))

for (const row of rows) {
  console.log(row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd())
}
