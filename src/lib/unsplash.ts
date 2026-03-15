const CACHE_PREFIX = 'dokkai_img_'

export function getCachedImage(articleId: string): string | null {
  return localStorage.getItem(CACHE_PREFIX + articleId)
}

export function setCachedImage(articleId: string, url: string): void {
  localStorage.setItem(CACHE_PREFIX + articleId, url)
}

export async function fetchArticleImage(
  title: string,
  unsplashKey: string
): Promise<string | null> {
  try {
    const query = encodeURIComponent(title)
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&client_id=${unsplashKey}`
    )
    if (!res.ok) return null
    const data = await res.json() as { urls: { small: string } }
    return data.urls.small ?? null
  } catch {
    return null
  }
}
