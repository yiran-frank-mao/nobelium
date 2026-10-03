import { Client as OfficialNotionClient } from '@notionhq/client'
import { config } from '@/lib/server/config'

export const officialNotionClient = config.notionApiKey
  ? new OfficialNotionClient({ auth: config.notionApiKey })
  : null
