import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'

const PAGE = {
  width: 12240,
  height: 15840,
  margin: 1080,
}

export function docxTitle(text: string) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text, bold: true })],
    spacing: { after: 240 },
  })
}

export function docxHeading(text: string, level: 1 | 2 | 3 = 1) {
  const heading = level === 1
    ? HeadingLevel.HEADING_1
    : level === 2
      ? HeadingLevel.HEADING_2
      : HeadingLevel.HEADING_3

  return new Paragraph({
    heading,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: level === 1 ? 300 : 220, after: 100 },
    keepNext: true,
  })
}

export function docxMeta(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, color: '66635C', size: 19 })],
    spacing: { after: 120 },
  })
}

export function docxParagraph(text: string, options?: { bold?: boolean; italics?: boolean }) {
  return new Paragraph({
    children: [new TextRun({ text, bold: options?.bold, italics: options?.italics, size: 22 })],
    spacing: { after: 120, line: 276 },
  })
}

export function docxTextBlocks(text: string) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  if (!blocks.length) return [docxParagraph('')]
  return blocks.map((block) => docxParagraph(block))
}

export function docxBullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 80, line: 276 },
  })
}

export function docxPassage(label: string, text: string) {
  return [
    new Paragraph({
      children: [new TextRun({ text: label, bold: true, color: '4F6E69', size: 20 })],
      spacing: { before: 100, after: 60 },
      keepNext: true,
    }),
    new Paragraph({
      children: [new TextRun({ text, italics: true, size: 21 })],
      spacing: { after: 140, line: 276 },
      indent: { left: 360, right: 180 },
    }),
  ]
}

export async function buildStudyDocxResponse(options: {
  title: string
  filename: string
  children: Paragraph[]
}) {
  const document = new Document({
    creator: 'Classics Courses',
    title: options.title,
    description: 'Private study data exported by the signed-in student.',
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin },
          },
        },
        children: options.children,
      },
    ],
  })

  const buffer = await Packer.toBuffer(document)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${options.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
