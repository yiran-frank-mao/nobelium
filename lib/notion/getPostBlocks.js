import { notionRendererClient } from '@/lib/server/notion-api'

export async function getPostBlocks (id) {
  try {
    const pageBlock = await notionRendererClient.getPage(id)
    return pageBlock
  } catch (error) {
    console.log(
      'Failed to fetch page blocks via notion-client. Share pages publicly or provide NOTION_ACCESS_TOKEN for private block rendering.'
    )
    throw error
  }
}
