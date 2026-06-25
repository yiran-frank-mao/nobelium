import { notionRendererClient } from '@/lib/server/notion-api'

// Tables in a Notion record map whose entries follow the `{ role, value }` shape.
const RECORD_MAP_TABLES = [
  'block',
  'collection',
  'collection_view',
  'notion_user',
  'comment',
  'discussion'
]

/**
 * Some notion-client versions return record map entries with an extra level of
 * nesting (e.g. `{ spaceId, value: { value, role } }`), while react-notion-x
 * and notion-utils expect `{ role, value }`. This flattens entries back to the
 * shape the renderer understands.
 */
function normalizeRecordMap (recordMap) {
  if (!recordMap) return recordMap

  for (const table of RECORD_MAP_TABLES) {
    const entries = recordMap[table]
    if (!entries) continue

    for (const [id, entry] of Object.entries(entries)) {
      const nested = entry?.value
      const isDoubleNested =
        nested &&
        typeof nested === 'object' &&
        'value' in nested &&
        'role' in nested &&
        nested.value &&
        typeof nested.value === 'object'

      if (isDoubleNested) {
        entries[id] = { role: nested.role, value: nested.value }
      }
    }
  }

  return recordMap
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function getPostBlocks (id) {
  const retries = 5
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const pageBlock = await notionRendererClient.getPage(id)
      return normalizeRecordMap(pageBlock)
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      const delay = 1000 * 2 ** attempt
      console.log(
        `[notion] failed to fetch blocks for "${id}", retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`
      )
      await sleep(delay)
    }
  }

  console.log(
    'Failed to fetch page blocks via notion-client. Share pages publicly or provide NOTION_ACCESS_TOKEN for private block rendering.'
  )
  throw lastError
}
