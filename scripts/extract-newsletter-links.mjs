#!/usr/bin/env node
/**
 * Reads a `gws gmail messages get --format json` response from stdin.
 * Outputs JSON: { sender: string, extractedLinks: {url,text}[], extractedLinksJson: string }
 *
 * Usage: gws gmail messages get <id> --format json | node scripts/extract-newsletter-links.mjs
 */
import { readFileSync } from 'node:fs'

const input = readFileSync('/dev/stdin', 'utf8')
let msg
try {
  msg = JSON.parse(input)
} catch {
  process.stdout.write(JSON.stringify({ sender: 'unknown', extractedLinks: [], extractedLinksJson: '[]' }))
  process.exit(0)
}

// Extract sender from message headers
const headers = msg.payload?.headers ?? []
const fromHeader = headers.find(h => h.name === 'From' || h.name === 'from')
const sender = fromHeader?.value ?? 'unknown'

// Find a body part by MIME type (walks multipart tree recursively)
function findPart(parts, mimeType) {
  if (!Array.isArray(parts)) return null
  for (const p of parts) {
    if (p.mimeType === mimeType && p.body?.data) return p.body.data
    const nested = findPart(p.parts, mimeType)
    if (nested) return nested
  }
  return null
}

// Gmail uses URL-safe base64 — convert +/_ then decode
const b64 =
  findPart(msg.payload?.parts, 'text/html') ??
  findPart(msg.payload?.parts, 'text/plain') ??
  msg.payload?.body?.data ??
  ''

const body = b64
  ? Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  : ''

// Extract all URLs from body text / HTML
const rawUrls = body.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []

// Deduplicate and filter noise
const seen = new Set()
const extractedLinks = []

for (const raw of rawUrls) {
  const url = raw.replace(/[.,;!?:]+$/, '') // strip trailing punctuation
  if (seen.has(url)) continue
  seen.add(url)

  if (/unsubscribe|optout|opt-out/i.test(url)) continue
  if (/[?&]utm_|\/\/(click|track)\./i.test(url)) continue
  if (/mailto:|tel:/i.test(url)) continue

  // Skip root-domain-only URLs (e.g. https://example.com/)
  try {
    const u = new URL(url)
    if (u.pathname === '/' || u.pathname === '') continue
  } catch {
    continue
  }

  extractedLinks.push({ url, text: url })
}

process.stdout.write(
  JSON.stringify({ sender, extractedLinks, extractedLinksJson: JSON.stringify(extractedLinks) })
)
