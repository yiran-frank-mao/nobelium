import { Feed } from 'feed'
import ReactDOMServer from 'react-dom/server'
import { clientConfig, config } from '@/lib/server/config'
import { getPostBlocks } from '@/lib/notion'
import { ConfigProvider } from '@/lib/config'
import NotionRenderer from '@/components/NotionRenderer'

const createFeedContent = async post => {
  const content = ReactDOMServer.renderToString(
    <ConfigProvider value={clientConfig}>
      <NotionRenderer recordMap={await getPostBlocks(post.id)} />
    </ConfigProvider>
  )
  const regexExp = /<div class="notion-collection-row"><div class="notion-collection-row-body"><div class="notion-collection-row-property"><div class="notion-collection-column-title"><svg.*?class="notion-collection-column-title-icon">.*?<\/svg><div class="notion-collection-column-title-body">.*?<\/div><\/div><div class="notion-collection-row-value">.*?<\/div><\/div><\/div><\/div>/g
  return content.replace(regexExp, '')
}

const blogAuthor = {
  name: config.author,
  email: config.email,
  link: config.link
}

/**
 * Authors of a single entry, taken from the post's `authors` (Notion person
 * property) and falling back to the author from `blog.config.js`.
 *
 * Only names are published: the emails Notion returns for workspace members
 * are not meant to be exposed, and the site itself never renders them.
 */
function getPostAuthors (post) {
  const authors = (post.authors ?? [])
    .map(author => author?.name?.trim())
    .filter(Boolean)
    .map(name => ({ name }))
  return authors.length ? authors : [blogAuthor]
}

export async function generateRss(posts) {
  const year = new Date().getFullYear()
  const feed = new Feed({
    title: config.title,
    description: config.description,
    id: `${config.link}/${config.path}`,
    link: `${config.link}/${config.path}`,
    language: config.lang,
    favicon: `${config.link}/favicon.png`,
    copyright: `All rights reserved ${year}, ${config.author}`,
    author: blogAuthor
  })
  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: `${config.link}/${post.slug}`,
      link: `${config.link}/${post.slug}`,
      description: post.summary,
      content: await createFeedContent(post),
      author: getPostAuthors(post),
      date: new Date(post.date)
    })
  }
  return feed.atom1()
}
