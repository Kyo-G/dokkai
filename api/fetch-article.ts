import { parse } from 'node-html-parser'

export const config = { runtime: 'edge' }

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, '')
}

// Wikipedia API — clean, reliable, no scraping needed
async function fetchWikipedia(url: URL): Promise<{ title: string; content: string }> {
  // Extract page title from URL, e.g. /wiki/東京 → 東京
  const title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, ''))

  const apiUrl = `https://${url.hostname}/w/api.php?` + new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts',
    titles: title,
    redirects: '1',
    formatversion: '2',
    origin: '*',
  })

  const res = await fetch(apiUrl)
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`)

  const data = await res.json() as {
    query: { pages: Array<{ title: string; extract?: string; missing?: boolean }> }
  }

  const page = data.query.pages[0]
  if (page.missing || !page.extract) throw new Error('页面不存在')

  // Clean HTML extract: remove tags, collapse whitespace
  const root = parse(page.extract)

  // Remove reference markers [1][2] etc.
  root.querySelectorAll('sup').forEach(el => el.remove())

  const lines: string[] = []
  // Walk sections and paragraphs
  for (const el of root.querySelectorAll('p, h2, h3')) {
    const text = decode(el.text).replace(/\s+/g, ' ').trim()
    if (!text || text === '[]') continue
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(text)) {
      lines.push(text)
    }
  }

  return { title: page.title, content: lines.join('\n') }
}

// General scraper for other sites
async function fetchGeneral(targetUrl: URL): Promise<{ title: string; content: string }> {
  const res = await fetch(targetUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`抓取失败 (${res.status})`)
  const html = await res.text()

  const root = parse(html)

  // Remove noise elements
  const noiseSelectors = [
    'script', 'style', 'nav', 'header', 'footer', 'aside', 'figure',
    'noscript', 'iframe', 'form', 'button',
    '[class*="related"]', '[class*="recommend"]', '[class*="pickup"]',
    '[class*="ranking"]', '[class*="banner"]', '[class*="ad-"]',
    '[class*="sns"]', '[class*="share"]', '[class*="breadcrumb"]',
    '[class*="comment"]', '[class*="sidebar"]',
  ]
  for (const sel of noiseSelectors) {
    try { root.querySelectorAll(sel).forEach(el => el.remove()) } catch {}
  }

  // Title
  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content')
  const title = decode(ogTitle ?? root.querySelector('title')?.text ?? '').trim()

  // Find main content container
  const containerSelectors = [
    'article', 'main',
    '[class*="article-body"]', '[class*="articleBody"]',
    '[class*="article__body"]', '[class*="story-body"]',
    '[class*="entry-content"]', '[class*="post-body"]',
    '[class*="article-content"]', '[class*="article_body"]',
    '[class*="news-content"]', '[class*="post-content"]',
  ]

  let container = root
  for (const sel of containerSelectors) {
    try {
      const el = root.querySelector(sel)
      if (el && el.querySelectorAll('p').length >= 2) {
        container = el as typeof root
        break
      }
    } catch {}
  }

  const lines: string[] = []
  for (const p of container.querySelectorAll('p')) {
    const text = decode(p.text).replace(/\s+/g, ' ').trim()
    if (text.length > 10 && /[\u3040-\u30ff\u4e00-\u9fff]/.test(text)) {
      lines.push(text)
    }
  }

  if (lines.length === 0) throw new Error('未找到日语正文，该网站可能需要 JavaScript 才能加载内容，请手动粘贴')

  return { title, content: lines.join('\n') }
}

export default async function handler(req: Request) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return json({ error: 'Missing url' }, 400)

  let targetUrl: URL
  try { targetUrl = new URL(url) } catch {
    return json({ error: '网址格式无效' }, 400)
  }

  try {
    const isWikipedia = targetUrl.hostname.endsWith('wikipedia.org') && targetUrl.pathname.startsWith('/wiki/')
    const result = isWikipedia
      ? await fetchWikipedia(targetUrl)
      : await fetchGeneral(targetUrl)

    return json(result)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 422)
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
