interface Segment {
  text: string
  reading?: string
}

function parse(text: string): Segment[] {
  const regex = /\{([^|{}]+)\|([^|{}]+)\}/g
  const segments: Segment[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      // Strip any leftover { } that didn't form a valid pattern
      segments.push({ text: text.slice(last, match.index).replace(/[{}]/g, '') })
    }
    // Only add ruby if the base text actually contains kanji; otherwise show plain
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(match[1])) {
      segments.push({ text: match[1], reading: match[2] })
    } else {
      segments.push({ text: match[1] })
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    segments.push({ text: text.slice(last).replace(/[{}]/g, '') })
  }

  return segments
}

interface Props {
  text: string
  className?: string
}

export default function Furigana({ text, className }: Props) {
  const segments = parse(text)

  return (
    <span className={className} lang="ja">
      {segments.map((seg, i) =>
        seg.reading ? (
          <ruby key={i}>
            {seg.text}
            <rt>{seg.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  )
}
