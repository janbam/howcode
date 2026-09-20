import { cp, mkdir, rm, watch } from 'node:fs/promises'
import path from 'node:path'
import { type BuildOptions, build, context } from 'esbuild'

const isWatchMode = process.argv.includes('--watch')
const projectRoot = process.cwd()
const buildRoot = path.join(projectRoot, 'build')
// Strips the extension token from Bun-era naming entries ("[dir]/[name].cjs").
const namingExtensionPattern = /\.[cm]?js$/

const buildTargets = [
  {
    label: 'electron-runtime',
    entrypoints: [
      path.join(projectRoot, 'src', 'electron', 'main', 'index.ts'),
      path.join(projectRoot, 'src', 'electron', 'preload', 'index.ts'),
    ],
    outdir: path.join(buildRoot, 'electron'),
    root: path.join(projectRoot, 'src', 'electron'),
    naming: {
      entry: '[dir]/[name].cjs',
    },
    format: 'cjs',
  },
  {
    label: 'desktop-runtime',
    entrypoints: [
      path.join(projectRoot, 'desktop', 'pi-threads.ts'),
      path.join(projectRoot, 'desktop', 'pi-skills.ts'),
      path.join(projectRoot, 'desktop', 'service-host.ts'),
      path.join(projectRoot, 'desktop', 'service-host-runtime.ts'),
      path.join(projectRoot, 'desktop', 'runtime-host', 'worker.ts'),
    ],
    outdir: path.join(buildRoot, 'desktop'),
    root: path.join(projectRoot, 'desktop'),
    naming: {
      entry: '[name].mjs',
    },
    format: 'esm',
  },
  {
    label: 'terminal-manager',
    entrypoints: [path.join(projectRoot, 'desktop', 'terminal', 'runtime.ts')],
    outdir: path.join(buildRoot, 'desktop'),
    root: path.join(projectRoot, 'desktop', 'terminal'),
    naming: {
      entry: 'terminal-manager.mjs',
    },
    format: 'esm',
  },
] as const

async function prepareBuildDirectories() {
  await rm(path.join(buildRoot, 'electron'), { recursive: true, force: true })
  await rm(path.join(buildRoot, 'desktop'), { recursive: true, force: true })
  await mkdir(path.join(buildRoot, 'electron'), { recursive: true })
  await mkdir(path.join(buildRoot, 'desktop'), { recursive: true })
}

async function copyDesktopResources() {
  const outputPath = path.join(buildRoot, 'resources')
  await rm(outputPath, { recursive: true, force: true })
  await cp(path.join(projectRoot, 'desktop', 'resources'), outputPath, {
    recursive: true,
  })
}

async function runBuild() {
  await prepareBuildDirectories()

  // Node-run port of the former Bun.build loop: esbuild backend, same targets.
  // entryNames keeps the original Bun naming tokens minus the extension; esbuild
  // would append ".js" to a template without [ext], so exact names (.cjs/.mjs)
  // come from outExtension keyed by the target format.
  const options = buildTargets.map(
    (target): BuildOptions => ({
      entryPoints: [...target.entrypoints],
      outdir: target.outdir,
      outbase: target.root,
      entryNames: target.naming.entry.replace(namingExtensionPattern, ''),
      outExtension: { '.js': target.format === 'cjs' ? '.cjs' : '.mjs' },
      target: `node${process.versions.node.split('.')[0]}`,
      format: target.format,
      packages: 'external',
      sourcemap: true,
      bundle: true,
      platform: 'node',
      logLevel: 'warning',
    }),
  )

  if (isWatchMode) {
    await Promise.all(options.map((opts) => context(opts).then((ctx) => ctx.watch())))
  } else {
    for (const [index, opts] of options.entries()) {
      const result = await build(opts)
      // esbuild reports failures in result.errors instead of throwing;
      // fail here so the error stays next to its cause (Bun's old throw:true).
      if (result.errors.length > 0)
        throw new Error(`esbuild failed for ${buildTargets[index]?.label}`)
      console.log(`Built ${buildTargets[index]?.label ?? `target-${index}`}.`)
    }
  }

  await copyDesktopResources()

  if (isWatchMode) {
    console.log('Watching Electron runtime bundles...')

    void (async () => {
      for await (const _event of watch(path.join(projectRoot, 'desktop', 'resources'), {
        recursive: true,
      })) {
        await copyDesktopResources()
        console.log('Copied desktop resources.')
      }
    })()
    await new Promise(() => {
      setInterval(() => {
        // Keep the watch process alive.
      }, 1 << 30)
    })
  }
}

void runBuild().catch((error) => {
  console.error(error)
  process.exit(1)
})
