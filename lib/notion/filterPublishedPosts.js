function normalizeText (value) {
  return String(value || '').trim().toLowerCase()
}

function extractPropertyValues (value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    if (value.name) return [value.name]
    if (value.value) return [value.value]
  }
  return value != null ? [value] : []
}

function hasPostType (post, includePages) {
  const typeValues = extractPropertyValues(post?.type).map(normalizeText)

  // Some databases don't use/require the type property. Treat missing type as "post".
  if (!typeValues.length) return true

  if (includePages) return typeValues.includes('post') || typeValues.includes('page')
  return typeValues.includes('post')
}

function isPublishedStatus (post) {
  const statusValues = extractPropertyValues(post?.status).map(normalizeText)
  if (!statusValues.length) return false
  return statusValues.includes('published')
}

function hasValidDate (post) {
  const rawDate = post?.date
  const timestamp = typeof rawDate === 'number' ? rawDate : new Date(rawDate).getTime()
  if (!Number.isFinite(timestamp)) return false
  return timestamp <= Date.now()
}

export default function filterPublishedPosts ({ posts, includePages }) {
  if (!posts || !posts.length) return []
  return posts
    .filter(post => hasPostType(post, includePages))
    .filter(post => post?.title && post?.slug && isPublishedStatus(post) && hasValidDate(post))
}
