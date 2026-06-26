/**
 * Convert blocks fetched from the official Notion API into the `recordMap`
 * shape that react-notion-x (and notion-utils) understand, so the existing
 * renderer, Table of Contents and RSS keep working without the unofficial
 * notion-client.
 */

function iconToString (icon) {
  if (!icon) return undefined
  if (icon.type === 'emoji') return icon.emoji
  if (icon.type === 'external') return icon.external?.url
  if (icon.type === 'file') return icon.file?.url
  return undefined
}

function fileUrl (file) {
  if (!file) return undefined
  if (file.type === 'external') return file.external?.url
  if (file.type === 'file') return file.file?.url
  return file.external?.url || file.file?.url
}

/**
 * Convert official rich text into the decoration-array format used by
 * react-notion-x: `[[plainText, [['b'], ['a', href], ...]], ...]`.
 */
function richTextToDecorations (richText = []) {
  if (!Array.isArray(richText) || !richText.length) return undefined

  return richText.map(rt => {
    if (rt.type === 'equation') {
      return ['⁍', [['e', rt.equation?.expression || '']]]
    }

    const text = rt.plain_text ?? rt.text?.content ?? ''
    const annotations = rt.annotations || {}
    const decorations = []

    if (rt.href) decorations.push(['a', rt.href])
    if (annotations.bold) decorations.push(['b'])
    if (annotations.italic) decorations.push(['i'])
    if (annotations.strikethrough) decorations.push(['s'])
    if (annotations.underline) decorations.push(['_'])
    if (annotations.code) decorations.push(['c'])
    if (annotations.color && annotations.color !== 'default') {
      decorations.push(['h', annotations.color])
    }

    return decorations.length ? [text, decorations] : [text]
  })
}

// Code-fence language normalization so Prism + the Mermaid override keep working.
function normalizeLanguage (language) {
  if (!language) return 'plain text'
  if (language === 'mermaid') return 'Mermaid'
  return language
}

const HEADING_TYPES = {
  heading_1: 'header',
  heading_2: 'sub_header',
  heading_3: 'sub_sub_header'
}

const LIST_TYPES = {
  bulleted_list_item: 'bulleted_list',
  numbered_list_item: 'numbered_list'
}

/**
 * Convert a single official block into a react-notion-x block value
 * (without `content`/`parent_*`, which the walker fills in).
 * Returns null to skip the block entirely.
 */
function convertBlock (block) {
  const type = block.type
  const value = {
    id: block.id,
    type,
    properties: {},
    format: {},
    created_time: Date.parse(block.created_time) || undefined,
    last_edited_time: Date.parse(block.last_edited_time) || undefined
  }

  const payload = block[type] || {}
  const color = payload.color
  if (color && color !== 'default') value.format.block_color = color

  switch (type) {
    case 'paragraph': {
      value.type = 'text'
      value.properties.title = richTextToDecorations(payload.rich_text)
      return value
    }
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      value.type = HEADING_TYPES[type]
      value.properties.title = richTextToDecorations(payload.rich_text)
      if (payload.is_toggleable) value.format.toggleable = true
      return value
    }
    case 'bulleted_list_item':
    case 'numbered_list_item': {
      value.type = LIST_TYPES[type]
      value.properties.title = richTextToDecorations(payload.rich_text)
      return value
    }
    case 'to_do': {
      value.properties.title = richTextToDecorations(payload.rich_text)
      value.properties.checked = [[payload.checked ? 'Yes' : 'No']]
      return value
    }
    case 'toggle': {
      value.properties.title = richTextToDecorations(payload.rich_text)
      return value
    }
    case 'quote': {
      value.properties.title = richTextToDecorations(payload.rich_text)
      return value
    }
    case 'callout': {
      value.properties.title = richTextToDecorations(payload.rich_text)
      const icon = iconToString(payload.icon)
      if (icon) value.format.page_icon = icon
      return value
    }
    case 'code': {
      value.properties.title = richTextToDecorations(payload.rich_text)
      value.properties.language = [[normalizeLanguage(payload.language)]]
      const caption = richTextToDecorations(payload.caption)
      if (caption) value.properties.caption = caption
      return value
    }
    case 'equation': {
      value.properties.title = [[payload.expression || '']]
      return value
    }
    case 'divider':
      return value
    case 'image':
    case 'video':
    case 'audio':
    case 'pdf':
    case 'file': {
      const url = fileUrl(payload)
      if (url) {
        value.properties.source = [[url]]
        value.format.display_source = url
      }
      const caption = richTextToDecorations(payload.caption)
      if (caption) value.properties.caption = caption
      return value
    }
    case 'embed':
    case 'bookmark':
    case 'link_preview': {
      const url = payload.url
      if (url) {
        value.type = type === 'embed' ? 'embed' : 'bookmark'
        value.properties.source = [[url]]
        value.properties.link = [[url]]
        value.format.display_source = url
        const caption = richTextToDecorations(payload.caption)
        value.properties.title = caption || [[url]]
      }
      return value
    }
    case 'column_list': {
      value.type = 'column_list'
      return value
    }
    case 'column': {
      value.type = 'column'
      if (typeof payload.width_ratio === 'number') {
        value.format.column_ratio = payload.width_ratio
      }
      return value
    }
    case 'synced_block':
    case 'template':
      // Transparent containers: render their children only.
      value.type = 'text'
      return value
    default:
      // Unknown/unsupported types act as transparent containers so any nested
      // children still render, instead of crashing the page.
      value.type = 'text'
      return value
  }
}

/**
 * @param {{ pageId: string, title?: string, blocks: Array }} args
 *   `blocks` is the list of top-level official blocks, each optionally carrying
 *   a recursively-fetched `children` array.
 */
export function officialToRecordMap ({ pageId, title, blocks = [] }) {
  const block = {}
  const signedUrls = {}
  const pageContent = []

  function walk (officialBlock, parentId) {
    const value = convertBlock(officialBlock)
    if (!value) return null

    value.parent_id = parentId
    value.parent_table = 'block'

    const sourceUrl = value.properties?.source?.[0]?.[0]
    if (sourceUrl) signedUrls[officialBlock.id] = sourceUrl

    const childIds = []
    for (const child of officialBlock.children || []) {
      const childId = walk(child, officialBlock.id)
      if (childId) childIds.push(childId)
    }
    if (childIds.length) value.content = childIds

    block[officialBlock.id] = { role: 'reader', value }
    return officialBlock.id
  }

  for (const top of blocks) {
    const id = walk(top, pageId)
    if (id) pageContent.push(id)
  }

  const pageBlock = {
    role: 'reader',
    value: {
      id: pageId,
      type: 'page',
      properties: title ? { title: [[title]] } : {},
      format: {},
      content: pageContent,
      parent_table: 'space'
    }
  }

  const recordMap = {
    // Page first so react-notion-x picks it as the root block.
    block: { [pageId]: pageBlock, ...block },
    collection: {},
    collection_view: {},
    collection_query: {},
    notion_user: {},
    signed_urls: signedUrls
  }

  // Strip `undefined` values: Next.js `getStaticProps` cannot serialize them.
  return JSON.parse(JSON.stringify(recordMap))
}

export default officialToRecordMap
