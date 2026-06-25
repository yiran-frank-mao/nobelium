import { Client as OfficialNotionClient } from '@notionhq/client'
import { NotionAPI } from 'notion-client'

const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.NOTION_ACCESS_TOKEN

export const officialNotionClient = NOTION_API_KEY
  ? new OfficialNotionClient({ auth: NOTION_API_KEY })
  : null

// react-notion-x still expects notion-client record maps for rendering.
export const notionRendererClient = new NotionAPI({
  authToken: process.env.NOTION_ACCESS_TOKEN
})
