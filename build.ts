/// <reference types="bun-types" />

/**
 * Build script for Claude Code.
 * Run with: bun run build.ts
 */

import { tieredImportsPlugin } from './plugins/tiered-imports.ts';

const FEATURE_FLAGS: Record<string, boolean> = {
  ABLATION_BASELINE: false,
  AGENT_MEMORY_SNAPSHOT: false,
  AGENT_TRIGGERS: false,
  AGENT_TRIGGERS_REMOTE: false,
  ALLOW_TEST_VERSIONS: false,
  ANTI_DISTILLATION_CC: false,
  AUTO_THEME: true,
  AWAY_SUMMARY: false,
  BASH_CLASSIFIER: false,
  BG_SESSIONS: false,
  BREAK_CACHE_COMMAND: false,
  BRIDGE_MODE: false,
  BUDDY: false,
  BUILDING_CLAUDE_APPS: false,
  BUILTIN_EXPLORE_PLAN_AGENTS: true,
  BYOC_ENVIRONMENT_RUNNER: false,
  CACHED_MICROCOMPACT: false,
  CCR_AUTO_CONNECT: false,
  CCR_MIRROR: false,
  CCR_REMOTE_SETUP: false,
  CHICAGO_MCP: false,
  COMMIT_ATTRIBUTION: false,
  COMPACTION_REMINDERS: true,
  CONNECTOR_TEXT: false,
  CONTEXT_COLLAPSE: false,
  COORDINATOR_MODE: false,
  COWORKER_TYPE_TELEMETRY: false,
  DAEMON: false,
  DIRECT_CONNECT: false,
  DOWNLOAD_USER_SETTINGS: false,
  DUMP_SYSTEM_PROMPT: false,
  ENHANCED_TELEMETRY_BETA: false,
  EXPERIMENTAL_SKILL_SEARCH: false,
  EXTRACT_MEMORIES: true,
  FILE_PERSISTENCE: false,
  FORK_SUBAGENT: false,
  HARD_FAIL: false,
  HISTORY_PICKER: true,
  HISTORY_SNIP: false,
  HOOK_PROMPTS: true,
  IS_LIBC_GLIBC: process.platform === "linux",
  IS_LIBC_MUSL: false,
  KAIROS: false,
  KAIROS_BRIEF: false,
  KAIROS_CHANNELS: false,
  KAIROS_DREAM: false,
  KAIROS_GITHUB_WEBHOOKS: false,
  KAIROS_PUSH_NOTIFICATION: false,
  LODESTONE: false,
  MCP_RICH_OUTPUT: true,
  MCP_SKILLS: false,
  MEMORY_SHAPE_TELEMETRY: false,
  MESSAGE_ACTIONS: true,
  MONITOR_TOOL: false,
  NATIVE_CLIENT_ATTESTATION: false,
  NATIVE_CLIPBOARD_IMAGE: false,
  NEW_INIT: false,
  OVERFLOW_TEST_TOOL: false,
  PERFETTO_TRACING: false,
  POWERSHELL_AUTO_MODE: false,
  PROACTIVE: false,
  PROMPT_CACHE_BREAK_DETECTION: true,
  QUICK_SEARCH: false,
  REACTIVE_COMPACT: false,
  REVIEW_ARTIFACT: false,
  RUN_SKILL_GENERATOR: false,
  SELF_HOSTED_RUNNER: false,
  SHOT_STATS: false,
  SKILL_IMPROVEMENT: false,
  SLOW_OPERATION_LOGGING: false,
  SSH_REMOTE: false,
  STREAMLINED_OUTPUT: true,
  TEAMMEM: false,
  TEMPLATES: false,
  TERMINAL_PANEL: false,
  TOKEN_BUDGET: false,
  TORCH: false,
  TRANSCRIPT_CLASSIFIER: false,
  TREE_SITTER_BASH: false,
  TREE_SITTER_BASH_SHADOW: false,
  UDS_INBOX: false,
  ULTRAPLAN: false,
  ULTRATHINK: false,
  UNATTENDED_RETRY: false,
  UPLOAD_USER_SETTINGS: false,
  VERIFICATION_AGENT: false,
  VOICE_MODE: false,
  WEB_BROWSER_TOOL: false,
  WORKFLOW_SCRIPTS: false,
};

const version = process.env.VERSION || "2.1.88-fast";
const buildTime = new Date().toISOString();

const define: Record<string, string> = {
  "MACRO.VERSION": JSON.stringify(version),
  "MACRO.BUILD_TIME": JSON.stringify(buildTime),
  "MACRO.BUILD_TIMESTAMP": JSON.stringify(buildTime.split("T")[0]),
  "MACRO.FEEDBACK_CHANNEL": JSON.stringify("#claude-code-feedback"),
  "MACRO.ISSUES_EXPLAINER": JSON.stringify(
    "report issues at https://github.com/anthropics/claude-code/issues"
  ),
  "MACRO.NATIVE_PACKAGE_URL": JSON.stringify("@anthropic-ai/claude-code"),
  "MACRO.PACKAGE_URL": JSON.stringify("@anthropic-ai/claude-code"),
  "MACRO.VERSION_CHANGELOG": JSON.stringify(""),
  "process.env.NODE_ENV": JSON.stringify("production"),
  "process.env.USER_TYPE": JSON.stringify("external"),
  "process.env.IS_DEMO": JSON.stringify(""),
};

// [fast-code] Clean dist before build to remove stale chunks
import { rmSync, mkdirSync } from "fs";
rmSync("./dist", { recursive: true, force: true });
mkdirSync("./dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["./src/entrypoints/cli.tsx"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  splitting: true,
  sourcemap: "none",
  minify: true,
  define,
  external: [
    // Cloud SDKs (dynamic imports, optional)
    "@anthropic-ai/bedrock-sdk",
    "@anthropic-ai/vertex-sdk",
    "@anthropic-ai/foundry-sdk",
    "@aws-sdk/client-bedrock",
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/credential-providers",
    "@aws-sdk/credential-provider-node",
    "@smithy/node-http-handler",
    "@smithy/core",
    "@azure/identity",
    "google-auth-library",
    // OpenTelemetry (dynamic imports)
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/core",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/semantic-conventions",
    "@opentelemetry/exporter-metrics-otlp-grpc",
    "@opentelemetry/exporter-metrics-otlp-http",
    "@opentelemetry/exporter-metrics-otlp-proto",
    "@opentelemetry/exporter-logs-otlp-grpc",
    "@opentelemetry/exporter-logs-otlp-http",
    "@opentelemetry/exporter-logs-otlp-proto",
    "@opentelemetry/exporter-trace-otlp-grpc",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@opentelemetry/exporter-prometheus",
    // Native packages (optional, dynamic imports)
    "sharp",
    // Other optional
    "@aws-sdk/client-sts",
    // FFI
    "bun:ffi",
    // [fast-code] Tier 2 externals — rarely used, save bundle size
    "ajv",
    "plist",
    "@mixmark-io/domino",
  ],
  plugins: [
    tieredImportsPlugin(),
    {
      name: "feature-flags",
      setup(build) {
        build.onResolve({ filter: /^bun:bundle$/ }, () => ({
          path: "bun:bundle",
          namespace: "bun-bundle-shim",
        }));

        build.onLoad(
          { filter: /.*/, namespace: "bun-bundle-shim" },
          () => ({
            contents: `
              const FLAGS = ${JSON.stringify(FEATURE_FLAGS)};
              export function feature(flag) {
                return FLAGS[flag] ?? false;
              }
            `,
            loader: "js",
          })
        );
      },
    },
    {
      // Replaces the full highlight.js bundle (194 languages, ~1.1 MB minified)
      // with a slim build containing only the 20 languages a coding assistant
      // realistically needs. Saves ~850 KB from the output.
      name: "hljs-slim",
      setup(build) {
        // Intercept bare "highlight.js" imports (both require and import).
        // The ESM entrypoint (es/index.js) re-exports lib/index.js, so
        // catching the bare specifier is sufficient.
        build.onResolve({ filter: /^highlight\.js$/ }, () => ({
          path: "highlight.js",
          namespace: "hljs-slim",
        }));

        build.onLoad(
          { filter: /.*/, namespace: "hljs-slim" },
          () => {
            // These 20 languages cover the vast majority of code blocks a
            // coding assistant will encounter. xml is included because it
            // provides the 'html' alias that many markdown code fences use.
            const languages = [
              "python",
              "javascript",
              "typescript",
              "java",
              "go",
              "rust",
              "bash",
              "json",
              "yaml",
              "xml",       // also registers 'html', 'xhtml', 'rss', etc.
              "css",
              "sql",
              "c",
              "cpp",
              "ruby",
              "php",
              "swift",
              "kotlin",
              "dockerfile",
              "markdown",
            ];

            const registrations = languages
              .map(
                (lang) =>
                  `hljs.registerLanguage('${lang}', require('highlight.js/lib/languages/${lang}'));`
              )
              .join("\n");

            return {
              contents: `
                var hljs = require('highlight.js/lib/core');
                ${registrations}
                hljs.HighlightJS = hljs;
                hljs.default = hljs;
                module.exports = hljs;
              `,
              loader: "js",
            };
          }
        );
      },
    },
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(
  `Build succeeded: ${result.outputs.length} files written to ./dist/`
);
