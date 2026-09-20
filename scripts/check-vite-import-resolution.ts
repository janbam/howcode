import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'

const sourceFileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'])
const sourceRoots = ['src/app', 'src/test', 'src/electron', 'desktop']
const howcodeImportPattern =
  /(?:import\s*\(\s*|(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?)['"](@howcode\/[^'"]+)['"]/g

// Node port of the former Bun.Glob scan: recursive walk filtered by extension.
function collectSourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const relativePath = path.relative(root, path.join(entry.parentPath, entry.name))
    if (sourceFileExtensions.has(path.extname(relativePath)))
      files.push(path.join(root, relativePath))
  }
  return files
}

async function main() {
  const server = await createServer({
    configFile: path.resolve('vite.config.ts'),
    configLoader: 'runner',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  })

  const failures: string[] = []

  try {
    const files = sourceRoots.flatMap((root) => collectSourceFiles(root))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const match of source.matchAll(howcodeImportPattern)) {
        const specifier = match[1]
        if (!specifier) continue
        const resolved = await server.pluginContainer.resolveId(specifier, path.resolve(file))
        if (!resolved) failures.push(`${file}: ${specifier}`)
      }
    }
  } finally {
    await server.close()
  }

  if (failures.length > 0) {
    console.error('Vite could not resolve these @howcode imports:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
}

await main()
