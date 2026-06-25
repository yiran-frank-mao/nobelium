import { config as BLOG } from '@/lib/server/config'

import dayjs from 'dayjs'
import { officialNotionClient } from '@/lib/server/notion-api'
import filterPublishedPosts from './filterPublishedPosts'

const shouldLogNotionDebug = process.env.NOTION_DEBUG === 'true'

function richTextToPlain (richText = []) {
  return richText.map(item => item.plain_text || '').join('')
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
      return (property.people || []).map(person => {
        const fullName = person.name || ''
        const [first_name, ...lastNameParts] = fullName.split(' ')
        return {
          id: person.id,
          first_name: first_name || '',
          last_name: lastNameParts.join(' '),
          profile_photo: person.avatar_url || ''
        }
      })
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
  })

  properties.slug = properties.slug ?? normalizedProperties.slug
  properties.summary = properties.summary ?? normalizedProperties.summary
  properties.status = properties.status ?? normalizedProperties.status
  properties.type = properties.type ?? normalizedProperties.type
  properties.tags = properties.tags ?? normalizedProperties.tags
  properties.date = properties.date ?? normalizedProperties.date

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
      const response = await queryDatabase({
        database_id: databaseId,
        start_cursor: cursor
      })
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

  const database = await officialNotionClient.databases.retrieve({
    database_id: databaseId
  })
  const dataSourceId = database?.data_sources?.[0]?.id

  if (!dataSourceId) {
    throw new Error(
      `Unable to find data source for database "${databaseId}".`
    )
  }

  do {
    const response = await queryDataSource({
      data_source_id: dataSourceId,
      start_cursor: cursor
    })
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
    await officialNotionClient.databases.retrieve({ database_id: databaseId })
  } catch (error) {
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
