#!/usr/bin/env node
// Content validator CLI — readable errors in the game data before they reach the game.
// Usage: node scripts/content-check.mjs [--strict] [--quiet] [--verbose] [--only=ref,boss] [--json] [--bundle <module.ts>]
// Docs: docs/tools/TOOLS.md. Exit: 0 ok, 1 errors in data, 2 data failed to load / bad options.
//
// Loads the TypeScript sources directly, with no extra dependencies: Node's built-in type
// stripping (Node >= 22.18) plus a tiny resolve hook for the extensionless imports used in
// src/. On older Node (or CONTENT_CHECK_LOADER=vite) it falls back to Vite's module runner.
import { existsSync, readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const abs = (p) => resolve(root, p);

let viteLoad = null;
async function loadWithVite(p) {
  if (!viteLoad) {
    const require = nodeModule.createRequire(abs('package.json'));
    const vite = await import(pathToFileURL(require.resolve('vite')).href);
    viteLoad = async (q) => (await vite.runnerImport(abs(q), { root, configFile: false, logLevel: 'silent' })).module;
  }
  return viteLoad(p);
}

const nativeOk = !!process.features?.typescript && typeof nodeModule.registerHooks === 'function' && process.env.CONTENT_CHECK_LOADER !== 'vite';
if (nativeOk) {
  nodeModule.registerHooks({
    resolve(spec, ctx, next) {
      if ((spec.startsWith('./') || spec.startsWith('../')) && !/\.[cm]?[jt]sx?$/.test(spec) && ctx.parentURL?.endsWith('.ts')) {
        for (const ext of ['.ts', '/index.ts']) {
          const u = new URL(spec + ext, ctx.parentURL);
          if (existsSync(fileURLToPath(u))) return next(u.href, ctx);
        }
      }
      return next(spec, ctx);
    },
  });
}
const FALLBACK_CODES = new Set(['ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX', 'ERR_UNKNOWN_FILE_EXTENSION', 'ERR_NO_TYPESCRIPT']);
async function loadModule(p) {
  if (!nativeOk) return loadWithVite(p);
  try {
    return await import(pathToFileURL(abs(p)).href);
  } catch (e) {
    if (!FALLBACK_CODES.has(e?.code)) throw e;
    process.stderr.write(`(content-check: Node nie wczytał ${p} [${e.code}] — przełączam na Vite)\n`);
    return loadWithVite(p);
  }
}

let cli;
try {
  cli = await loadModule('src/tools/contentCheckCli.ts');
} catch (e) {
  process.stderr.write(`Walidator nie wystartował: ${e?.stack ?? e}\n`);
  process.exit(2);
}
process.exitCode = await cli.runContentCheck(process.argv.slice(2), {
  loadModule,
  readFile: (p) => {
    try {
      return readFileSync(abs(p), 'utf8');
    } catch {
      return undefined;
    }
  },
  out: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
  color: !!process.stdout.isTTY && !process.env.NO_COLOR && !process.argv.includes('--no-color'),
  now: () => performance.now(),
});
