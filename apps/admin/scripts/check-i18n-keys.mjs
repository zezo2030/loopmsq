import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, '../src')

function walk(d, acc = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    const s = fs.statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(f)) acc.push(p)
  }
  return acc
}

const files = walk(src)
const keys = new Set()
// Avoid false positives like split('T') matching t('T')
const tCall = /(?:^|[^A-Za-z0-9_])t\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g
const labelKey = /labelKey:\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8')
  let m
  while ((m = tCall.exec(c))) keys.add(m[1])
  while ((m = labelKey.exec(c))) keys.add(m[1])
}

const arPath = path.join(src, 'locales/ar/common.json')
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'))
const missing = [...keys].filter((k) => !(k in ar)).sort()

const segs = new Set()
for (const k of missing) k.split(/[._]/).forEach((s) => segs.add(s))

console.log(JSON.stringify({ totalInCode: keys.size, missingCount: missing.length, missing, uniqueSegments: [...segs].sort() }, null, 2))
