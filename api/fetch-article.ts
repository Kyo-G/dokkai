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

export default async function handler(req: Request) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return json({ error: 'Missing url' }, 400)

  let targetUrl: URL
  try { targetUrl = new URL(url) } catch {
    return json({ error: 'Invalid url' }, 400)
  }

  let html: string
  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return json({ error: `抓取失败 (${res.status})` }, 502)
    html = await res.text()
  } catch (e) {
    return json({ error: `网络错误: ${String(e)}` }, 502)
  }

  const root = parse(html)

  // Remove noise elements
  for (const sel of ['script', 'style', 'nav', 'header', 'footer', 'aside', 'figure', 'noscript']) {
    root.querySelectorAll(sel).forEach(el => el.remove())
  }

  // Title: og:title → <title>
  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content')
  const title = decode(ogTitle ?? root.querySelector('title')?.text ?? '').trim()

  // Find main content area: <article> → <main> → common class patterns → body
  const candidates = [
    'article',
    'main',
    '[class*="article-body"]',
    '[class*="articleBody"]',
    '[class*="article__body"]',
    '[class*="story-body"]',
    '[class*="entry-content"]',
    '[class*="post-body"]',
    '[class*="article-content"]',
    '[class*="NewsArticle"]',
    '[class*="article_body"]',
  ]

  let container = root
  for (const sel of candidates) {
    const el = root.querySelector(sel)
    if (el) { container = el as typeof root; break }
  }

  // Extract paragraphs from the chosen container
  const lines: string[] = []
  for (const p of container.querySelectorAll('p')) {
    const text = decode(p.text).replace(/\s+/g, ' ').trim()
    if (text.length > 5 && /[\u3040-\u30ff\u4e00-\u9fff]/.test(text)) {
      lines.push(text)
    }
  }

  if (lines.length === 0) return json({ error: '未找到日语正文，请手动粘贴内容' }, 422)

  return json({ title, content: lines.join('\n') })
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
