import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const partsDir = path.join(root, 'content', 'eye-of-courage', 'workbook-pdf-parts')
const outputDir = path.join(root, 'public', 'eye-of-courage')
const output = path.join(outputDir, 'workbook.pdf')

if (fs.existsSync(partsDir)) {
  const parts = fs.readdirSync(partsDir).filter((name) => name.endsWith('.txt')).sort()
  if (parts.length) {
    const base64 = parts.map((name) => fs.readFileSync(path.join(partsDir, name), 'utf8').trim()).join('')
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(output, Buffer.from(base64, 'base64'))
    console.log(`Built Eye of Courage workbook PDF from ${parts.length} source parts.`)
  }
}
