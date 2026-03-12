import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

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

  // Parse with linkedom, then extract main content with Readability
  const { document } = parseHTML(html)

  // Set the base URL so Readability can resolve relative links
  const base = document.createElement('base')
  base.setAttribute('href', targetUrl.origin)
  document.head?.appendChild(base)

  const reader = new Readability(document as unknown as Document)
  const article = reader.parse()

  if (!article || !article.textContent?.trim()) {
    return json({ error: '无法提取正文，请手动粘贴内容' }, 422)
  }

  // Clean up the extracted text:
  // - Normalize whitespace within lines
  // - Keep meaningful line breaks (paragraph structure)
  const content = article.textContent
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0 && /[\u3040-\u30ff\u4e00-\u9fff]/.test(line))
    .join('\n')

  if (!content) return json({ error: '未找到日语内容' }, 422)

  return json({ title: article.title ?? '', content })
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
