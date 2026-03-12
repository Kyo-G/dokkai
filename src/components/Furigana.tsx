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
      segments.push({ text: text.slice(last, match.index) })
    }
    segments.push({ text: match[1], reading: match[2] })
    last = match.index + match[0].length
  }

  if (last < text.length) {
    segments.push({ text: text.slice(last) })
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
