/// <reference types="bun-types" />

/**
 * tiered-imports — Bun build plugin that splits main.tsx into two
 * evaluation tiers so the CLI prompt renders ~70 ms faster.
 *
 * Background
 * ----------
 * main.tsx has ~164 static `import` statements. When cli.tsx runs
 * `await import('../main.js')`, Bun must evaluate every one of them
 * synchronously before the `main()` function is even callable. This
 * takes ~135 ms — time the user spends staring at a blank terminal.
 *
 * Only a fraction of those imports are needed before Commander parses
 * argv and the REPL prompt renders. The rest (React, Ink, 40+ tool
 * modules, MCP client, migrations, dialogs, state stores, etc.) are
 * only used inside the Commander action handler, well after the prompt
 * is displayed.
 *
 * Strategy
 * --------
 * At build time, rewrite main.tsx to:
 *
 *   1. Keep Tier 1 imports as static `import` statements (Commander,
 *      chalk, path, bootstrap/state, config, auth, profiler, etc.).
 *      These evaluate immediately when main.js loads (~30 ms).
 *
 *   2. Move Tier 2 imports into a synthetic barrel module
 *      (`_tier2Barrel.ts`). In the rewritten main.tsx, replace the
 *      Tier 2 `import` lines with:
 *        a. `const _t2p = import('./_tier2Barrel.js');` — starts
 *           loading immediately (non-blocking)
 *        b. `let` declarations for each Tier 2 binding
 *        c. Inside `main()`, before first Tier 2 use:
 *           `const _t2 = await _t2p; <destructure all bindings>`
 *
 *   3. Because every Tier 2 symbol is used inside `async function
 *      main()` or functions it calls (run(), launchRepl callbacks),
 *      the `let` declarations + late assignment is safe.
 *
 * The net effect: the `await import('../main.js')` in cli.tsx returns
 * after only ~30 ms of synchronous work (Tier 1). Commander sets up
 * and renders the prompt. Meanwhile, the `_t2p` promise is resolving
 * in the background. By the time the Commander action handler fires
 * (user presses Enter or a flag triggers the action), Tier 2 is
 * already evaluated.
 *
 * Observed results
 * ----------------
 * The plugin correctly rewrites main.tsx and generates a Tier 2 barrel
 * loaded via dynamic import. However, Bun's chunk-splitting algorithm
 * merges Tier 1 and Tier 2 code into shared chunks when they have
 * overlapping transitive dependencies (which most modules do, via
 * utility libraries). In the current build:
 *
 *   - Tier 1 static chain: ~72 chunks, ~4.7 MB
 *   - Tier 2 unique chunks: ~14 chunks, ~148 KB
 *   - Shared chunks: 72 (100% overlap)
 *
 * The 2.88 MB "mega chunk" contains 4,478 functions from both tiers
 * because Bun cannot split it without duplicating shared code.
 *
 * To unlock the full ~70ms win, the next step is one of:
 *   1. Wait for Bun to support `manualChunks` configuration
 *   2. Refactor Tier 1 modules to avoid importing from utility modules
 *      shared with Tier 2 (break the transitive dependency overlap)
 *   3. Use a two-entrypoint build: compile main-tier1.tsx and
 *      main-tier2.tsx as separate entrypoints with `splitting: true`,
 *      then have cli.tsx load them sequentially
 *
 * In the meantime, the plugin:
 *   - Defers ~148 KB of truly unique Tier 2 code
 *   - Establishes the `_resolveTier2()` / barrel architecture so
 *     future splits are additive (just move specifiers between tiers)
 *   - Adds a `tier2_resolved` profile checkpoint for measurement
 *
 * Usage (in build.ts)
 * -------------------
 *   import { tieredImportsPlugin } from './plugins/tiered-imports.ts';
 *   plugins: [ tieredImportsPlugin(), ... ]
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

/**
 * Tier 1 specifier patterns. An import whose `from` specifier matches
 * any of these stays as a static import in main.tsx. Everything else
 * goes to Tier 2.
 *
 * Be conservative: if something *might* be needed before Commander
 * finishes parsing, keep it in Tier 1. The penalty for a false positive
 * (keeping something in Tier 1 that could be Tier 2) is just a few ms
 * of unnecessary evaluation. The penalty for a false negative (moving
 * something to Tier 2 that was needed in Tier 1) is a runtime crash.
 */
const TIER1_SPECIFIERS: RegExp[] = [
  // --- Profiler / side-effect bootstrapping ---
  /startupProfiler/,
  /mdm\/rawRead/,
  /keychainPrefetch/,

  // --- Core Node / npm packages ---
  /^@commander-js\//,
  /^chalk$/,
  /^fs$/,
  /^path$/,
  /^lodash/,
  /^bun:bundle$/,
  /^react$/,  // React is used at module level for JSX in type positions
              // and in launchRepl — keep in Tier 1 to avoid TDZ issues
              // with const/let. It's cheap (~4ms) compared to Ink.

  // --- bootstrap/state ---
  /\/bootstrap\/state/,

  // --- Config, env, settings ---
  /\/utils\/config/,
  /\/utils\/envUtils/,
  /\/utils\/managedEnv/,
  /\/utils\/cliArgs/,
  /\/utils\/earlyInput/,
  /\/utils\/process/,
  /\/utils\/cwd/,
  /\/utils\/Shell/,
  /\/utils\/platform/,
  /\/utils\/bundledMode/,
  /\/utils\/errors/,
  /\/utils\/log/,
  /\/utils\/debug/,
  /\/utils\/settings\//,
  /\/entrypoints\/init/,

  // --- Auth (preAction checks) ---
  /\/utils\/auth/,

  // --- Model resolution (--model flag) ---
  /\/utils\/model\//,

  // --- Permissions (--permission-mode flag) ---
  /\/utils\/permissions\//,
  /\/utils\/worktreeModeEnabled/,

  // --- Analytics (init fires sinks in preAction) ---
  /\/services\/analytics/,

  // --- Constants ---
  /\/constants\//,

  // --- Policy limits (checked early) ---
  /\/services\/policyLimits/,
  /\/services\/remoteManagedSettings/,

  // --- CLI flag handling ---
  /\/utils\/effort/,
  /\/utils\/fastMode/,
  /\/utils\/warningHandler/,
  /\/utils\/sessionStorage/,
  /\/utils\/uuid/,
  /\/utils\/renderOptions/,
  /\/utils\/betas/,
  /\/utils\/cleanupRegistry/,
  /\/utils\/concurrentSessions/,
  /\/utils\/gracefulShutdown/,
  /\/utils\/array/,
  /\/utils\/json/,
  /\/utils\/stringUtils/,
  /\/utils\/slowOperations/,
  /\/utils\/commitAttribution/,
  /\/utils\/hooks\//,

  // --- Context (prefetch fires early) ---
  /\/context\.js$/,

  // --- History ---
  /\/history\.js$/,

  // --- Commands (registered in run()) ---
  /\/commands/,

  // --- Interactive helpers (exitWithError etc.) ---
  /\/interactiveHelpers/,

  // --- REPL launcher (just a function ref, tiny) ---
  /\/replLauncher/,

  // --- Messages util (createSystemMessage / createUserMessage) ---
  /\/utils\/messages/,

  // --- Session ingress auth ---
  /\/utils\/sessionIngressAuth/,
];

function isTier1(specifier: string): boolean {
  for (const re of TIER1_SPECIFIERS) {
    if (re.test(specifier)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Import parser
// ---------------------------------------------------------------------------

interface ParsedImport {
  /** Raw source text of the import (may span multiple lines) */
  raw: string;
  /** Start line index (0-based) */
  startLine: number;
  /** End line index (exclusive, 0-based) */
  endLine: number;
  /** Module specifier */
  specifier: string;
  /** Bindings clause between `import` and `from` (empty for side-effect) */
  bindings: string;
  /** True for `import type { ... }` */
  typeOnly: boolean;
  /** Tier assignment */
  tier: 1 | 2;
}

/**
 * Extract all top-level import statements from main.tsx.
 * Returns them in order, plus the line number where imports end and
 * the function body begins.
 */
function parseTopLevelImports(source: string): {
  imports: ParsedImport[];
  /** First line index that is NOT an import or inter-import side-effect */
  bodyStart: number;
} {
  const lines = source.split('\n');
  const imports: ParsedImport[] = [];
  let i = 0;
  let lastImportEnd = 0;

  while (i < lines.length) {
    const trimmed = lines[i]!.trim();

    // Skip blanks, comments, eslint directives, side-effect calls
    if (
      trimmed === '' ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('*/') ||
      trimmed.startsWith('profileCheckpoint(') ||
      trimmed.startsWith('startMdmRawRead(') ||
      trimmed.startsWith('startKeychainPrefetch(')
    ) {
      i++;
      if (
        trimmed.startsWith('profileCheckpoint(') ||
        trimmed.startsWith('startMdmRawRead(') ||
        trimmed.startsWith('startKeychainPrefetch(')
      ) {
        lastImportEnd = i;
      }
      continue;
    }

    // Not an import? Check for `const ... = require(...)` or
    // `const ... = feature(...)` patterns between imports
    if (!trimmed.startsWith('import ') && !trimmed.startsWith('import{')) {
      if (
        trimmed.startsWith('const ') ||
        trimmed.startsWith('let ') ||
        trimmed.startsWith('var ')
      ) {
        // require/feature blocks — keep scanning
        // Find end of statement
        let j = i;
        while (j < lines.length - 1 && !lines[j]!.trim().endsWith(';')) {
          j++;
        }
        i = j + 1;
        lastImportEnd = i;
        continue;
      }
      break; // body starts here
    }

    // Accumulate multi-line import
    const startLine = i;
    let raw = lines[i]!;
    while (
      i < lines.length - 1 &&
      !raw.includes(' from ') &&
      !raw.match(/^import\s+['"]/)
    ) {
      i++;
      raw += '\n' + lines[i]!;
    }
    const endLine = i + 1;
    i++;
    lastImportEnd = endLine;

    // Parse specifier
    const fromMatch = raw.match(/from\s+['"]([^'"]+)['"]/);
    const sideEffectMatch = raw.match(/^import\s+['"]([^'"]+)['"]/);
    const specifier = fromMatch?.[1] ?? sideEffectMatch?.[1] ?? '';
    if (!specifier) continue;

    // Parse bindings
    const bindingsMatch = raw.match(/^import\s+(.*?)\s+from\s+/s);
    const bindings = bindingsMatch?.[1] ?? '';

    const typeOnly = /^import\s+type[\s{]/.test(raw.trim());

    imports.push({
      raw,
      startLine,
      endLine,
      specifier,
      bindings,
      typeOnly,
      tier: typeOnly ? 1 : isTier1(specifier) ? 1 : 2,
    });
  }

  return { imports, bodyStart: lastImportEnd };
}

/**
 * Extract individual binding names from an import bindings clause.
 * Examples:
 *   "React"                          -> ["React"]
 *   "{ a, b, c as d }"              -> ["a", "b", "d"]
 *   "{ type Foo, Bar }"             -> ["Bar"] (skip type-only)
 *   "{ type AppState, getDefault }" -> ["getDefault"]
 */
function extractBindingNames(bindings: string): string[] {
  const names: string[] = [];
  const trimmed = bindings.trim();

  // Default import: `import React from '...'`
  if (!trimmed.startsWith('{')) {
    // Could be `React` or `chalk` or `mapValues` etc.
    const defaultMatch = trimmed.match(/^(\w+)/);
    if (defaultMatch) names.push(defaultMatch[1]!);

    // Check for `import Default, { named } from '...'`
    const namedPart = trimmed.match(/,\s*\{([^}]+)\}/);
    if (namedPart) {
      for (const part of namedPart[1]!.split(',')) {
        const p = part.trim();
        if (!p || p.startsWith('type ')) continue;
        const asMatch = p.match(/\S+\s+as\s+(\S+)/);
        names.push(asMatch ? asMatch[1]! : p);
      }
    }
    return names;
  }

  // Named imports: `{ a, b as c, type D }`
  const inner = trimmed.slice(1, -1); // strip { }
  for (const part of inner.split(',')) {
    const p = part.trim();
    if (!p || p.startsWith('type ')) continue;
    const asMatch = p.match(/\S+\s+as\s+(\S+)/);
    names.push(asMatch ? asMatch[1]! : p);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export function tieredImportsPlugin() {
  let tier2Imports: ParsedImport[] = [];

  return {
    name: 'tiered-imports',
    setup(build: any) {
      // ------------------------------------------------------------------
      // Intercept main.tsx: rewrite to defer Tier 2 imports
      // ------------------------------------------------------------------
      build.onLoad(
        { filter: /\/src\/main\.tsx$/ },
        async (args: { path: string }) => {
          const source = readFileSync(args.path, 'utf-8');
          const { imports, bodyStart } = parseTopLevelImports(source);

          tier2Imports = imports.filter((im) => im.tier === 2 && !im.typeOnly);
          const tier1Imports = imports.filter((im) => im.tier === 1 || im.typeOnly);

          if (tier2Imports.length === 0) return undefined;

          const lines = source.split('\n');
          const output: string[] = [];

          // ---- Tier 1 static imports (unchanged) ----
          for (const im of tier1Imports) {
            output.push(im.raw);
          }

          // ---- Inter-import side-effect calls ----
          for (let idx = 0; idx < bodyStart; idx++) {
            const t = lines[idx]!.trim();
            if (
              t.startsWith('profileCheckpoint(') ||
              t.startsWith('startMdmRawRead(') ||
              t.startsWith('startKeychainPrefetch(')
            ) {
              output.push(lines[idx]!);
            }
          }

          // ---- const/require blocks (feature-gated lazy requires) ----
          // These appear between imports in the source and must be preserved.
          // They reference things like `feature('COORDINATOR_MODE')` which
          // is Tier 1 (bun:bundle).
          for (let idx = 0; idx < bodyStart; idx++) {
            const t = lines[idx]!.trim();
            if (
              (t.startsWith('const ') || t.startsWith('let ') || t.startsWith('var ')) &&
              (t.includes('require(') || t.includes('feature('))
            ) {
              // Emit the full statement (may span multiple lines)
              let j = idx;
              let stmt = lines[j]!;
              while (!stmt.trimEnd().endsWith(';') && j < bodyStart - 1) {
                j++;
                stmt += '\n' + lines[j]!;
              }
              output.push(stmt);
            }
          }

          // ---- Tier 2: eager dynamic import ----
          output.push('');
          output.push('// ---- Tier 2: starts loading immediately, awaited inside main() ----');
          output.push("const _tier2Promise = import('./_tier2Barrel.js');");
          output.push('');

          // Declare Tier 2 bindings as `let` so the body code compiles.
          // They'll be assigned after `await _tier2Promise` in main().
          const allT2Names: string[] = [];
          for (const im of tier2Imports) {
            if (!im.bindings) continue;
            const names = extractBindingNames(im.bindings);
            for (const n of names) {
              output.push(`let ${n}: any;`);
              allT2Names.push(n);
            }
          }

          output.push('');
          output.push('/** Resolve Tier 2 — call once at the top of main(). */');
          output.push('async function _resolveTier2(): Promise<void> {');
          output.push('  const _t2 = await _tier2Promise;');
          for (const n of allT2Names) {
            output.push(`  ${n} = _t2.${n};`);
          }
          output.push('}');
          output.push('');

          // ---- Body of main.tsx (everything after imports) ----
          // Inject `await _resolveTier2()` at the top of `main()`.
          let injected = false;
          for (let idx = bodyStart; idx < lines.length; idx++) {
            const line = lines[idx]!;
            output.push(line);

            // Find `export async function main()` and inject after its
            // opening brace
            if (!injected && /export\s+async\s+function\s+main\s*\(/.test(line)) {
              // The opening brace might be on the same line or the next
              if (line.includes('{')) {
                output.push("  await _resolveTier2();");
                output.push("  profileCheckpoint('tier2_resolved');");
                injected = true;
              } else {
                // Look ahead for the brace
                while (idx < lines.length - 1) {
                  idx++;
                  const nextLine = lines[idx]!;
                  output.push(nextLine);
                  if (nextLine.includes('{')) {
                    output.push("  await _resolveTier2();");
                    output.push("  profileCheckpoint('tier2_resolved');");
                    injected = true;
                    break;
                  }
                }
              }
            }
          }

          return {
            contents: output.join('\n'),
            loader: 'tsx',
          };
        }
      );

      // ------------------------------------------------------------------
      // Virtual barrel module: _tier2Barrel.ts
      // ------------------------------------------------------------------
      build.onResolve(
        { filter: /\.\/_tier2Barrel\.js$/ },
        (args: { resolveDir: string }) => ({
          path: resolve(args.resolveDir || '.', '_tier2Barrel.ts'),
          namespace: 'tier2-barrel',
        })
      );

      build.onLoad(
        { filter: /.*/, namespace: 'tier2-barrel' },
        () => {
          const barrelLines: string[] = [
            '// Auto-generated Tier 2 barrel (tiered-imports plugin)',
            '// Re-exports every module deferred from main.tsx.',
            '',
          ];

          for (const im of tier2Imports) {
            if (!im.bindings) {
              // Side-effect import
              barrelLines.push(`import '${im.specifier}';`);
            } else {
              // Rewrite `import X from '...'` → `export { default as X } from '...'`
              // Rewrite `import { a, b } from '...'` → `export { a, b } from '...'`
              const trimmed = im.bindings.trim();
              if (trimmed.startsWith('{')) {
                // Named imports — strip `type` members for re-export
                const inner = trimmed.slice(1, -1);
                const exportable = inner
                  .split(',')
                  .map((p) => p.trim())
                  .filter((p) => p && !p.startsWith('type '))
                  .join(', ');
                if (exportable) {
                  barrelLines.push(
                    `export { ${exportable} } from '${im.specifier}';`
                  );
                }
              } else {
                // Default import
                const defaultName = trimmed.match(/^(\w+)/)?.[1];
                if (defaultName) {
                  barrelLines.push(
                    `export { default as ${defaultName} } from '${im.specifier}';`
                  );
                }

                // Also handle `import Default, { named }` pattern
                const namedPart = trimmed.match(/,\s*\{([^}]+)\}/);
                if (namedPart) {
                  const exportable = namedPart[1]!
                    .split(',')
                    .map((p) => p.trim())
                    .filter((p) => p && !p.startsWith('type '))
                    .join(', ');
                  if (exportable) {
                    barrelLines.push(
                      `export { ${exportable} } from '${im.specifier}';`
                    );
                  }
                }
              }
            }
          }

          return {
            contents: barrelLines.join('\n'),
            loader: 'ts',
          };
        }
      );
    },
  };
}
