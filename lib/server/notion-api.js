import { Client as OfficialNotionClient } from '@notionhq/client'

const NOTION_API_KEY = process.env.NOTION_API_KEY

export const officialNotionClient = NOTION_API_KEY
  ? new OfficialNotionClient({ auth: NOTION_API_KEY })
  : null
