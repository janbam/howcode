// Node-run launcher for TS scripts whose import graph relies on Bun's
// extensionless TS resolution (Node type-stripping can't resolve those).
// esbuild-bundles the entry with packages external, then imports the result.
// Usage: node scripts/dev-runner.mjs <script.ts> [args passed to the script]

import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { argv } from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
if (!argv[2]) {
  console.error('usage: node scripts/dev-runner.mjs <script.ts> [args...]')
  process.exit(1)
}
const entry = path.resolve(argv[2])
const stamp = path.basename(entry, '.ts').replace(/[^a-z0-9_-]/gi, '_')
const outDir = path.join(projectRoot, 'build', 'dev-runner', stamp)
const outFile = path.join(outDir, 'script.mjs')

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const result = await build({
  entryPoints: [entry],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  logLevel: 'warning',
})
if (result.errors.length > 0) process.exit(1)

await writeFile(path.join(outDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8')

await import(pathToFileURL(outFile).href)
