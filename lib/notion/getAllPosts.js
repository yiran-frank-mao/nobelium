import { config as BLOG } from '@/lib/server/config'

import { createHash } from 'crypto'
import dayjs from 'dayjs'
import { officialNotionClient } from '@/lib/server/notion-api'
import filterPublishedPosts from './filterPublishedPosts'

const shouldLogNotionDebug = process.env.NOTION_DEBUG === 'true'

function richTextToPlain (richText = []) {
  return richText.map(item => item.plain_text || '').join('')
}

/**
 * Build a Gravatar avatar URL from an email (or any stable seed as fallback).
 * Uses the `identicon` default so authors without a Gravatar still get an image.
 */
export function gravatarUrl (seed) {
  const normalized = String(seed || '').trim().toLowerCase()
  const hash = createHash('md5').update(normalized).digest('hex')
  return `https://gravatar.com/avatar/${hash}?d=identicon`
}

function mapPerson (person) {
  const email = person.person?.email || null
  return {
    id: person.id,
    name: person.name || '',
    email,
    avatar: gravatarUrl(email || person.name || person.id)
  }
}

const RETRYABLE_NOTION_CODES = new Set([
  'service_unavailable',
  'internal_server_error',
  'notionhq_client_request_timeout',
  'notionhq_client_response_error',
  'rate_limited',
  'conflict_error',
  'bad_gateway'
])

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function isRetryableNotionError (error) {
  if (!error) return false
  if (RETRYABLE_NOTION_CODES.has(error.code)) return true
  const status = error.status
  return status === 429 || (status >= 500 && status <= 599)
}

/**
 * Retry a Notion API call with exponential backoff so transient outages
 * (e.g. 503 service_unavailable) don't fail the whole build.
 */
async function withRetry (fn, { retries = 5, baseDelay = 1000 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === retries || !isRetryableNotionError(error)) throw error
      const delay = baseDelay * 2 ** attempt
      console.log(
        `[notion] transient error (${error.code || error.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`
      )
      await sleep(delay)
    }
  }
  throw lastError
}

function toLegacyPropertyValue (property) {
  switch (property.type) {
    case 'title':
    case 'rich_text':
      return richTextToPlain(property[property.type])
    case 'select':
      return property.select ? [property.select.name] : undefined
    case 'status':
      return property.status ? [property.status.name] : undefined
    case 'multi_select':
      return property.multi_select?.map(option => option.name) || []
    case 'date':
      return property.date
        ? {
            start_date: property.date.start,
            end_date: property.date.end,
            time_zone: property.date.time_zone
          }
        : undefined
    case 'people':
      return (property.people || []).map(mapPerson)
    case 'number':
      return property.number
    case 'checkbox':
      return property.checkbox
    case 'url':
      return property.url
    case 'email':
      return property.email
    case 'phone_number':
      return property.phone_number
    default:
      return undefined
  }
}

function normalizePropertyName (name = '') {
  return name.trim().toLowerCase().replace(/\s+/g, '_')
}

function mapDatabasePageToPost (page) {
  const properties = { id: page.id }
  const normalizedProperties = {}

  Object.entries(page.properties).forEach(([propertyKey, property]) => {
    const value = toLegacyPropertyValue(property)
    const propertyName = property?.name || propertyKey
    properties[propertyName] = value
    normalizedProperties[normalizePropertyName(propertyName)] = value

    // Keep backwards-compatible canonical keys expected by Nobelium.
    if (property.type === 'title' && !properties.title) {
      properties.title = value
    }
    if (property.type === 'date' && !properties.date) {
      properties.date = value
    }
    if (property.type === 'multi_select' && !properties.tags) {
      properties.tags = value
    }
    if (property.type === 'people' && !properties.authors) {
      properties.authors = value
    }
  })

  properties.slug = properties.slug ?? normalizedProperties.slug
  properties.summary = properties.summary ?? normalizedProperties.summary
  properties.status = properties.status ?? normalizedProperties.status
  properties.type = properties.type ?? normalizedProperties.type
  properties.tags = properties.tags ?? normalizedProperties.tags
  properties.date = properties.date ?? normalizedProperties.date
  properties.authors = properties.authors ?? normalizedProperties.authors ?? []

  properties.fullWidth = false
  properties.date = (
    properties.date?.start_date
      ? dayjs.tz(properties.date.start_date)
      : dayjs(page.created_time)
  ).valueOf()

  return properties
}

async function queryDatabaseRows (databaseId) {
  const rows = []
  let cursor = undefined

  const queryDatabase = officialNotionClient?.databases?.query
  if (typeof queryDatabase === 'function') {
    do {
      const response = await withRetry(() => queryDatabase({
        database_id: databaseId,
        start_cursor: cursor
      }))
      rows.push(...response.results)
      cursor = response.has_more ? response.next_cursor : undefined
    } while (cursor)
    return rows
  }

  const queryDataSource = officialNotionClient?.dataSources?.query
  if (typeof queryDataSource !== 'function') {
    throw new Error(
      'Notion SDK does not expose databases.query or dataSources.query.'
    )
  }

  const database = await withRetry(() => officialNotionClient.databases.retrieve({
    database_id: databaseId
  }))
  const dataSourceId = database?.data_sources?.[0]?.id

  if (!dataSourceId) {
    throw new Error(
      `Unable to find data source for database "${databaseId}".`
    )
  }

  do {
    const response = await withRetry(() => queryDataSource({
      data_source_id: dataSourceId,
      start_cursor: cursor
    }))
    rows.push(...response.results)
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  return rows
}

/**
 * @param {{ includePages: boolean }} - false: posts only / true: include pages
 */
export async function getAllPosts ({ includePages = false }) {
  const databaseId = process.env.NOTION_PAGE_ID

  if (!officialNotionClient) {
    console.log('NOTION_API_KEY is required to query Notion database.')
    return []
  }

  try {
    await withRetry(() => officialNotionClient.databases.retrieve({ database_id: databaseId }))
  } catch (error) {
    // Fail the build on transient outages so we never deploy an empty site;
    // only treat genuine access/permission errors as "no posts".
    if (isRetryableNotionError(error)) throw error
    console.log(
      `Notion database "${databaseId}" is not accessible by the integration key.`
    )
    return []
  }

  const rows = await queryDatabaseRows(databaseId)
  const data = rows.map(mapDatabasePageToPost)

  if (shouldLogNotionDebug) {
    console.log(
      `[notion-debug] fetched rows=${rows.length} includePages=${includePages}`
    )
  }

  // remove all the the items doesn't meet requirements
  const posts = filterPublishedPosts({ posts: data, includePages })

  if (shouldLogNotionDebug || (rows.length > 0 && posts.length === 0)) {
    console.log(
      `[notion-debug] mapped=${data.length} published=${posts.length} includePages=${includePages}`
    )
  }

  if (shouldLogNotionDebug && data.length > 0) {
    const sample = data[0]
    console.log(
      '[notion-debug] first row snapshot:',
      JSON.stringify({
        title: sample.title,
        slug: sample.slug,
        status: sample.status,
        type: sample.type,
        tags: sample.tags,
        date: sample.date
      })
    )
  }

  // Sort by date
  if (BLOG.sortByDate) {
    posts.sort((a, b) => b.date - a.date)
  }
  return posts
}
