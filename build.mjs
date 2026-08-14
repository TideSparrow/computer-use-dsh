// build.mjs — inject native helper sources into src/host.js, emit dist/plugin.host.js & dist/plugin.client.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(root, p), 'utf8')

// JSON.stringify a string yields a valid double-quoted JS string literal
// (escapes quotes, backslashes, newlines), so embedding is injection-safe.
const embed = (source) => JSON.stringify(source)

let host = read('src/host.js')
// Use FUNCTION replacers: a string replacement would interpret $', $&, $` and $n
// patterns inside the helper sources (PowerShell has $' sequences) and corrupt them.
host = host.replace('__MACOS_HELPER_SOURCE__', () => embed(read('native/macos-helper.swift')))
host = host.replace('__LINUX_HELPER_SOURCE__', () => embed(read('native/linux-helper.sh')))
host = host.replace('__WINDOWS_HELPER_SOURCE__', () => embed(read('native/windows-helper.ps1')))

const client = read('src/client.js')

mkdirSync(join(root, 'dist'), { recursive: true })
writeFileSync(join(root, 'dist/plugin.host.js'), host)
writeFileSync(join(root, 'dist/plugin.client.js'), client)
writeFileSync(join(root, 'dist/plugin.json'), JSON.stringify({ host, client }, null, 2))

console.log('built:')
console.log('  dist/plugin.host.js   (%d bytes)', Buffer.byteLength(host))
console.log('  dist/plugin.client.js (%d bytes)', Buffer.byteLength(client))
console.log('  dist/plugin.json      (host+client bundle)')
