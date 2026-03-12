export const config = { runtime: 'edge' }

function decode(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, '')
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extract(html: string): { title: string; content: string } {
  // Remove noisy blocks
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Title: prefer og:title → <title> → first <h1>
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const h1Tag = cleaned.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = stripTags(
    ogTitle?.[1] ?? titleTag?.[1] ?? (h1Tag ? h1Tag[1] : '') ?? ''
  )

  // Paragraphs
  const paragraphs: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = pRegex.exec(cleaned)) !== null) {
    const text = stripTags(m[1])
    // Keep only lines with Japanese characters
    if (text.length > 5 && /[\u3040-\u30ff\u4e00-\u9fff]/.test(text)) {
      paragraphs.push(text)
    }
  }

  return { title, content: paragraphs.join('\n') }
}

export default async function handler(req: Request) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  let targetUrl: URL
  try { targetUrl = new URL(url) } catch {
    return new Response('Invalid url', { status: 400 })
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return new Response(`Fetch failed: ${res.status}`, { status: 502 })

    const html = await res.text()
    const { title, content } = extract(html)

    if (!content) return new Response('No Japanese content found', { status: 422 })

    return new Response(JSON.stringify({ title, content }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
}
