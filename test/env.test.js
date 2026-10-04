const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { resolve } = require('node:path')
const { after, describe, it } = require('node:test')

const { applyEnvOverrides, envNameOf, listConfigOptions } = require('../lib/server/env')

const ROOT = resolve(__dirname, '..')

const defaults = {
  title: "Yi's",
  since: 2023,
  postsPerPage: 10,
  sortByDate: true,
  path: '',
  seo: {
    keywords: ['Blog', 'Website', 'Notion'],
    googleSiteVerification: ''
  },
  comment: {
    provider: 'cusdis',
    cusdisConfig: {
      appId: 'default-app-id',
      host: 'https://cusdis.com'
    }
  },
  notionPageId: undefined
}

function override (env) {
  return applyEnvOverrides(defaults, env).config
}

describe('envNameOf', () => {
  it('upper snake cases the option path', () => {
    assert.equal(envNameOf(['title']), 'NOBELIUM_TITLE')
    assert.equal(envNameOf(['postsPerPage']), 'NOBELIUM_POSTS_PER_PAGE')
    assert.equal(envNameOf(['notionApiKey']), 'NOBELIUM_NOTION_API_KEY')
    assert.equal(envNameOf(['ogImageGenerateURL']), 'NOBELIUM_OG_IMAGE_GENERATE_URL')
    assert.equal(
      envNameOf(['comment', 'cusdisConfig', 'appId']),
      'NOBELIUM_COMMENT_CUSDIS_CONFIG_APP_ID'
    )
  })
})

describe('listConfigOptions', () => {
  it('lists nested options, parents before children', () => {
    const names = listConfigOptions(defaults).map(option => option.name)
    assert.ok(names.includes('seo.keywords'))
    assert.ok(names.includes('comment.cusdisConfig.appId'))
    assert.ok(names.indexOf('comment') < names.indexOf('comment.cusdisConfig'))
    assert.ok(names.indexOf('comment.cusdisConfig') < names.indexOf('comment.cusdisConfig.appId'))
  })

  it('infers the type from the default value', () => {
    const types = Object.fromEntries(listConfigOptions(defaults).map(o => [o.name, o.type]))
    assert.deepEqual(types, {
      title: 'string',
      since: 'number',
      postsPerPage: 'number',
      sortByDate: 'boolean',
      path: 'string',
      seo: 'object',
      'seo.keywords': 'array',
      'seo.googleSiteVerification': 'string',
      comment: 'object',
      'comment.provider': 'string',
      'comment.cusdisConfig': 'object',
      'comment.cusdisConfig.appId': 'string',
      'comment.cusdisConfig.host': 'string',
      notionPageId: 'string'
    })
  })
})

describe('applyEnvOverrides', () => {
  it('keeps the defaults when nothing is set', () => {
    assert.deepEqual(override({}), defaults)
  })

  it('does not mutate the given config', () => {
    const config = { title: 'original', comment: { provider: 'cusdis' } }
    applyEnvOverrides(config, { NOBELIUM_TITLE: 'changed', NOBELIUM_COMMENT_PROVIDER: 'gitalk' })
    assert.deepEqual(config, { title: 'original', comment: { provider: 'cusdis' } })
  })

  it('overrides strings verbatim, including empty ones', () => {
    assert.equal(override({ NOBELIUM_TITLE: 'My blog' }).title, 'My blog')
    assert.equal(override({ NOBELIUM_COMMENT_PROVIDER: '' }).comment.provider, '')
  })

  it('overrides nested options', () => {
    const config = override({ NOBELIUM_COMMENT_CUSDIS_CONFIG_APP_ID: 'from-env' })
    assert.equal(config.comment.cusdisConfig.appId, 'from-env')
    assert.equal(config.comment.cusdisConfig.host, 'https://cusdis.com')
  })

  it('parses numbers', () => {
    assert.equal(override({ NOBELIUM_POSTS_PER_PAGE: '25' }).postsPerPage, 25)
    assert.equal(override({ NOBELIUM_SINCE: ' 2019 ' }).since, 2019)
    assert.equal(override({ NOBELIUM_SINCE: '' }).since, '')
    assert.throws(
      () => override({ NOBELIUM_POSTS_PER_PAGE: 'ten' }),
      /NOBELIUM_POSTS_PER_PAGE must be a number/
    )
  })

  it('parses booleans', () => {
    for (const raw of ['true', 'TRUE', '1', 'yes', 'on']) {
      assert.equal(override({ NOBELIUM_SORT_BY_DATE: raw }).sortByDate, true, raw)
    }
    for (const raw of ['false', 'False', '0', 'no', 'off', '']) {
      assert.equal(override({ NOBELIUM_SORT_BY_DATE: raw }).sortByDate, false, raw)
    }
    assert.throws(
      () => override({ NOBELIUM_SORT_BY_DATE: 'maybe' }),
      /NOBELIUM_SORT_BY_DATE must be a boolean/
    )
  })

  it('parses arrays as a comma separated list or JSON', () => {
    assert.deepEqual(override({ NOBELIUM_SEO_KEYWORDS: 'a, b ,c' }).seo.keywords, ['a', 'b', 'c'])
    assert.deepEqual(override({ NOBELIUM_SEO_KEYWORDS: '["a","b, c"]' }).seo.keywords, ['a', 'b, c'])
    assert.deepEqual(override({ NOBELIUM_SEO_KEYWORDS: '' }).seo.keywords, [])
    assert.throws(
      () => override({ NOBELIUM_SEO_KEYWORDS: '[oops' }),
      /NOBELIUM_SEO_KEYWORDS must be a JSON array/
    )
  })

  it('merges JSON objects into the defaults', () => {
    const config = override({ NOBELIUM_COMMENT: '{"cusdisConfig":{"appId":"merged"}}' })
    assert.deepEqual(config.comment, {
      provider: 'cusdis',
      cusdisConfig: { appId: 'merged', host: 'https://cusdis.com' }
    })
    assert.throws(
      () => override({ NOBELIUM_SEO: '"nope"' }),
      /NOBELIUM_SEO must be a JSON object/
    )
  })

  it('lets a single option win over a JSON object override', () => {
    const config = override({
      NOBELIUM_COMMENT: '{"cusdisConfig":{"appId":"merged","host":"https://self.hosted"}}',
      NOBELIUM_COMMENT_CUSDIS_CONFIG_APP_ID: 'most-specific'
    })
    assert.equal(config.comment.cusdisConfig.appId, 'most-specific')
    assert.equal(config.comment.cusdisConfig.host, 'https://self.hosted')
  })

  it('still reads the legacy, unprefixed Notion variables', () => {
    assert.equal(override({ NOTION_PAGE_ID: 'legacy-id' }).notionPageId, 'legacy-id')
    assert.equal(
      override({ NOTION_PAGE_ID: 'legacy-id', NOBELIUM_NOTION_PAGE_ID: 'prefixed-id' }).notionPageId,
      'prefixed-id'
    )
  })

  it('reports which options were overridden', () => {
    const { applied } = applyEnvOverrides(defaults, {
      NOBELIUM_TITLE: 'My blog',
      NOTION_PAGE_ID: 'legacy-id'
    })
    assert.deepEqual(applied, [
      { name: 'title', envName: 'NOBELIUM_TITLE' },
      { name: 'notionPageId', envName: 'NOTION_PAGE_ID' }
    ])
  })

  it('warns about unknown prefixed variables', () => {
    const warnings = []
    const warn = console.warn
    console.warn = message => warnings.push(message)
    after(() => { console.warn = warn })

    override({ NOBELIUM_TITLE: 'fine', NOBELIUM_TITEL: 'typo' })

    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /NOBELIUM_TITEL/)
    assert.doesNotMatch(warnings[0], /NOBELIUM_TITLE\b/)
  })
})

describe('lib/server/config', () => {
  const read = env => JSON.parse(execFileSync(
    process.execPath,
    ['-e', 'console.log(JSON.stringify(require("./lib/server/config")))'],
    { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf-8' }
  ))

  it('applies the environment on top of blog.config.js', () => {
    const { config } = read({
      NOBELIUM_TITLE: 'Env title',
      NOBELIUM_POSTS_PER_PAGE: '3',
      NOBELIUM_SHOW_ARCHIVE: 'false',
      NOBELIUM_SEO_KEYWORDS: 'env, keywords',
      NOBELIUM_ANALYTICS_GA_CONFIG_MEASUREMENT_ID: 'G-FROMENV'
    })
    assert.equal(config.title, 'Env title')
    assert.equal(config.postsPerPage, 3)
    assert.equal(config.showArchive, false)
    assert.deepEqual(config.seo.keywords, ['env', 'keywords'])
    assert.equal(config.analytics.gaConfig.measurementId, 'G-FROMENV')
  })

  it('keeps the secrets out of the client config', () => {
    const { config, clientConfig } = read({ NOBELIUM_NOTION_API_KEY: 'ntn_secret' })
    assert.equal(config.notionApiKey, 'ntn_secret')
    assert.equal('notionApiKey' in clientConfig, false)
    assert.equal('notionAccessToken' in clientConfig, false)
    assert.equal(clientConfig.title, config.title)
  })
})
