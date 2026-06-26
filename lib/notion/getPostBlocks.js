import { officialNotionClient } from '@/lib/server/notion-api'
import { officialToRecordMap } from './officialToRecordMap'

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
        `[notion] transient error fetching blocks (${error.code || error.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`
      )
      await sleep(delay)
    }
  }
  throw lastError
}

// Block types whose children are separate pages/databases we don't want to inline.
const SKIP_CHILD_RECURSION = new Set(['child_page', 'child_database'])

/**
 * Recursively fetch all child blocks of a block/page via the official API,
 * attaching nested children under each block's `children` array.
 */
async function fetchChildren (blockId) {
  const results = []
  let cursor

  do {
    const response = await withRetry(() => officialNotionClient.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100
    }))
    results.push(...response.results)
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  for (const child of results) {
    if (child.has_children && !SKIP_CHILD_RECURSION.has(child.type)) {
      child.children = await fetchChildren(child.id)
    }
  }

  return results
}

export async function getPostBlocks (id) {
  if (!officialNotionClient) {
    throw new Error('NOTION_API_KEY is required to fetch page content from the official Notion API.')
  }

  const blocks = await fetchChildren(id)
  return officialToRecordMap({ pageId: id, blocks })
}
