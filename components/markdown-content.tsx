import { Fragment, ReactNode } from 'react'

type Props = {
  content: string
}

function safeHref(value: string) {
  const href = value.trim()
  if (/^(https?:\/\/|mailto:|\/)/i.test(href)) return href
  return null
}

function inlineNodes(text: string): ReactNode[] {
  const output: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) output.push(<Fragment key={`t-${key++}`}>{text.slice(last, match.index)}</Fragment>)
    const token = match[0]

    if (token.startsWith('**')) {
      output.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      output.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`')) {
      output.push(<code key={`c-${key++}`}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/)
      if (linkMatch) {
        const href = safeHref(linkMatch[2])
        output.push(href
          ? <a key={`a-${key++}`} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{linkMatch[1]}</a>
          : <Fragment key={`x-${key++}`}>{linkMatch[1]}</Fragment>)
      }
    }

    last = pattern.lastIndex
  }

  if (last < text.length) output.push(<Fragment key={`t-${key++}`}>{text.slice(last)}</Fragment>)
  return output
}

function isBullet(line: string) {
  return /^\s*[-*+]\s+/.test(line)
}

function isNumbered(line: string) {
  return /^\s*\d+[.)]\s+/.test(line)
}

function listDepth(line: string) {
  const spaces = line.match(/^\s*/)?.[0].length ?? 0
  return Math.floor(spaces / 2)
}

function isTableLine(line: string) {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.endsWith('|')
}

function isTableSeparator(line: string) {
  const trimmed = line.trim()
  if (!isTableLine(line)) return false
  const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim())
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function tableCells(line: string) {
  return line.trim().slice(1, -1).split('|').map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

export default function MarkdownContent({ content }: Props) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  let key = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const text = heading[2]
      if (level === 1) blocks.push(<h2 key={`h-${key++}`} style={{ fontSize: 32, marginTop: 28 }}>{inlineNodes(text)}</h2>)
      else if (level === 2) blocks.push(<h3 key={`h-${key++}`} style={{ fontSize: 26, marginTop: 26 }}>{inlineNodes(text)}</h3>)
      else blocks.push(<h4 key={`h-${key++}`} style={{ fontSize: 20, marginTop: 22 }}>{inlineNodes(text)}</h4>)
      index += 1
      continue
    }

    if (isTableLine(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const header = tableCells(line)
      index += 2
      const body: string[][] = []
      while (index < lines.length && isTableLine(lines[index])) {
        body.push(tableCells(lines[index]))
        index += 1
      }

      blocks.push(
        <div key={`table-${key++}`} style={{ overflowX: 'auto', margin: '18px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 1.55 }}>
            <thead>
              <tr>{header.map((cell, cellIndex) => <th key={cellIndex} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>{inlineNodes(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>{header.map((_, cellIndex) => <td key={cellIndex} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>{inlineNodes(row[cellIndex] ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (isBullet(line)) {
      const items: Array<{ text: string; depth: number }> = []
      while (index < lines.length && isBullet(lines[index])) {
        items.push({
          text: lines[index].replace(/^\s*[-*+]\s+/, '').trim(),
          depth: listDepth(lines[index]),
        })
        index += 1
      }
      blocks.push(
        <ul key={`ul-${key++}`} style={{ lineHeight: 1.75, paddingLeft: 24 }}>
          {items.map((item, itemIndex) => <li key={itemIndex} style={{ marginLeft: item.depth * 20 }}>{inlineNodes(item.text)}</li>)}
        </ul>
      )
      continue
    }

    if (isNumbered(line)) {
      const items: Array<{ text: string; depth: number }> = []
      while (index < lines.length && isNumbered(lines[index])) {
        items.push({
          text: lines[index].replace(/^\s*\d+[.)]\s+/, '').trim(),
          depth: listDepth(lines[index]),
        })
        index += 1
      }
      blocks.push(
        <ol key={`ol-${key++}`} style={{ lineHeight: 1.75, paddingLeft: 24 }}>
          {items.map((item, itemIndex) => <li key={itemIndex} style={{ marginLeft: item.depth * 20 }}>{inlineNodes(item.text)}</li>)}
        </ol>
      )
      continue
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quoteLines.push(lines[index].trim().slice(2))
        index += 1
      }
      blocks.push(
        <blockquote key={`q-${key++}`} style={{ margin: '20px 0', paddingLeft: 18, borderLeft: '3px solid var(--sage)', lineHeight: 1.75 }}>
          {inlineNodes(quoteLines.join(' '))}
        </blockquote>
      )
      continue
    }

    const paragraphLines: string[] = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = lines[index]
      const nextTrimmed = next.trim()
      const startsTable = isTableLine(next) && index + 1 < lines.length && isTableSeparator(lines[index + 1])
      if (!nextTrimmed || /^(#{1,4})\s+/.test(nextTrimmed) || isBullet(next) || isNumbered(next) || nextTrimmed.startsWith('> ') || startsTable) break
      paragraphLines.push(nextTrimmed)
      index += 1
    }

    blocks.push(
      <p key={`p-${key++}`} style={{ lineHeight: 1.8, margin: '14px 0' }}>
        {inlineNodes(paragraphLines.join(' '))}
      </p>
    )
  }

  return <div>{blocks}</div>
}
