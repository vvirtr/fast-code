// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { type as osType, version as osVersion, release as osRelease } from 'os'
import { env } from '../utils/env.js'
import { getIsGit } from '../utils/git.js'
import { getCwd } from '../utils/cwd.js'
import { getIsNonInteractiveSession } from '../bootstrap/state.js'
import { getCurrentWorktreeSession } from '../utils/worktree.js'
import { getSessionStartDate } from './common.js'
import { getInitialSettings } from '../utils/settings/settings.js'
import {
  AGENT_TOOL_NAME,
  VERIFICATION_AGENT_TYPE,
} from '../tools/AgentTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../tools/FileWriteTool/prompt.js'
import { FILE_READ_TOOL_NAME } from '../tools/FileReadTool/prompt.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import { TODO_WRITE_TOOL_NAME } from '../tools/TodoWriteTool/constants.js'
import { TASK_CREATE_TOOL_NAME } from '../tools/TaskCreateTool/constants.js'
import type { Tools } from '../Tool.js'
import type { Command } from '../types/command.js'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import {
  getCanonicalName,
  getMarketingNameForModel,
} from '../utils/model/model.js'
import { getSkillToolCommands } from 'src/commands.js'
import { SKILL_TOOL_NAME } from '../tools/SkillTool/constants.js'
import { getOutputStyleConfig } from './outputStyles.js'
import type {
  MCPServerConnection,
  ConnectedMCPServer,
} from '../services/mcp/types.js'
import { GLOB_TOOL_NAME } from 'src/tools/GlobTool/prompt.js'
import { GREP_TOOL_NAME } from 'src/tools/GrepTool/prompt.js'
import { hasEmbeddedSearchTools } from 'src/utils/embeddedTools.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../tools/AskUserQuestionTool/prompt.js'
import {
  EXPLORE_AGENT,
  EXPLORE_AGENT_MIN_QUERIES,
} from 'src/tools/AgentTool/built-in/exploreAgent.js'
import { areExplorePlanAgentsEnabled } from 'src/tools/AgentTool/builtInAgents.js'
import {
  isScratchpadEnabled,
  getScratchpadDir,
} from '../utils/permissions/filesystem.js'
import { isEnvTruthy } from '../utils/envUtils.js'
import { isReplModeEnabled } from '../tools/REPLTool/constants.js'
import { feature } from 'bun:bundle'
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js'
import { shouldUseGlobalCacheScope } from '../utils/betas.js'
import { isForkSubagentEnabled } from '../tools/AgentTool/forkSubagent.js'
import {
  systemPromptSection,
  DANGEROUS_uncachedSystemPromptSection,
  resolveSystemPromptSections,
} from './systemPromptSections.js'
import { SLEEP_TOOL_NAME } from '../tools/SleepTool/prompt.js'
import { TICK_TAG } from './xml.js'
import { logForDebugging } from '../utils/debug.js'
import { loadMemoryPrompt } from '../memdir/memdir.js'
import { isUndercover } from '../utils/undercover.js'
import { isMcpInstructionsDeltaEnabled } from '../utils/mcpInstructionsDelta.js'

// Dead code elimination: conditional imports for feature-gated modules
/* eslint-disable @typescript-eslint/no-require-imports */
const getCachedMCConfigForFRC = feature('CACHED_MICROCOMPACT')
  ? (
      require('../services/compact/cachedMCConfig.js') as typeof import('../services/compact/cachedMCConfig.js')
    ).getCachedMCConfig
  : null

const proactiveModule =
  feature('PROACTIVE') || feature('KAIROS')
    ? require('../proactive/index.js')
    : null
const BRIEF_PROACTIVE_SECTION: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../tools/BriefTool/prompt.js') as typeof import('../tools/BriefTool/prompt.js')
      ).BRIEF_PROACTIVE_SECTION
    : null
const briefToolModule =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (require('../tools/BriefTool/BriefTool.js') as typeof import('../tools/BriefTool/BriefTool.js'))
    : null
const DISCOVER_SKILLS_TOOL_NAME: string | null = feature(
  'EXPERIMENTAL_SKILL_SEARCH',
)
  ? (
      require('../tools/DiscoverSkillsTool/prompt.js') as typeof import('../tools/DiscoverSkillsTool/prompt.js')
    ).DISCOVER_SKILLS_TOOL_NAME
  : null
// Capture the module (not .isSkillSearchEnabled directly) so spyOn() in tests
// patches what we actually call — a captured function ref would point past the spy.
const skillSearchFeatureCheck = feature('EXPERIMENTAL_SKILL_SEARCH')
  ? (require('../services/skillSearch/featureCheck.js') as typeof import('../services/skillSearch/featureCheck.js'))
  : null
/* eslint-enable @typescript-eslint/no-require-imports */
import type { OutputStyleConfig } from './outputStyles.js'
import { CYBER_RISK_INSTRUCTION } from './cyberRiskInstruction.js'

export const CLAUDE_CODE_DOCS_MAP_URL =
  'https://github.com/vvirtr/fast-code.md'

/**
 * Boundary marker separating static (cross-org cacheable) content from dynamic content.
 * Everything BEFORE this marker in the system prompt array can use scope: 'global'.
 * Everything AFTER contains user/session-specific content and should not be cached.
 *
 * WARNING: Do not remove or reorder this marker without updating cache logic in:
 * - src/utils/api.ts (splitSysPromptPrefix)
 * - src/services/api/claude.ts (buildSystemPromptBlocks)
 */
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
  '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'

// @[MODEL LAUNCH]: Update the latest frontier model.
const FRONTIER_MODEL_NAME = 'Claude Opus 4.6'

// @[MODEL LAUNCH]: Update the model family IDs below to the latest in each tier.
const CLAUDE_4_5_OR_4_6_MODEL_IDS = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
}

function getHooksSection(): string {
  return `Hooks (shell commands on tool events) may provide feedback — treat as from the user. If blocked by a hook, adjust or ask the user to check their hook config.`
}

function getSystemRemindersSection(): string {
  return `<system-reminder> tags are system-added context. Conversation has unlimited context via auto-summarization.`
}

function getAntModelOverrideSection(): string | null {
  if (process.env.USER_TYPE !== 'ant') return null
  if (isUndercover()) return null
  return getAntModelOverrideConfig()?.defaultSystemPromptSuffix || null
}

function getLanguageSection(
  languagePreference: string | undefined,
): string | null {
  if (!languagePreference) return null

  return `Respond in ${languagePreference}. Keep technical terms and code identifiers in their original form.`
}

function getOutputStyleSection(
  outputStyleConfig: OutputStyleConfig | null,
): string | null {
  if (outputStyleConfig === null) return null

  return `# Output Style: ${outputStyleConfig.name}
${outputStyleConfig.prompt}`
}

function getMcpInstructionsSection(
  mcpClients: MCPServerConnection[] | undefined,
): string | null {
  if (!mcpClients || mcpClients.length === 0) return null
  return getMcpInstructions(mcpClients)
}

export function prependBullets(items: Array<string | string[]>): string[] {
  return items.flatMap(item =>
    Array.isArray(item)
      ? item.map(subitem => `  - ${subitem}`)
      : [` - ${item}`],
  )
}

function getSimpleIntroSection(
  outputStyleConfig: OutputStyleConfig | null,
): string {
  // eslint-disable-next-line custom-rules/prompt-spacing
  return `
You are Fast Code, a CLI agent for software engineering.${outputStyleConfig !== null ? ' Follow the "Output Style" section below.' : ''}

${CYBER_RISK_INSTRUCTION}`
}

function getSimpleSystemSection(): string {
  const items = [
    `Text output is displayed to the user (markdown supported). If a tool call is denied, adjust your approach.`,
    `<system-reminder> tags in tool results/messages are from the system, not the user.`,
    getHooksSection(),
    `Context is unlimited through automatic summarization.`,
  ]

  return ['# System', ...prependBullets(items)].join(`\n`)
}

function getSimpleDoingTasksSection(): string {
  const items = [
    `Interpret unclear instructions in the context of software engineering tasks and the current working directory.`,
    `Read code before modifying it. Prefer editing existing files over creating new ones.`,
    `If an approach fails, diagnose why before switching tactics. Escalate to the user with ${ASK_USER_QUESTION_TOOL_NAME} only when genuinely stuck.`,
    `Avoid security vulnerabilities (OWASP top 10). Fix insecure code immediately.`,
    `Do only what was asked — no extra refactoring, docstrings, comments, or speculative abstractions. Only validate at system boundaries.`,
    `If the user asks for help: /help. Feedback: ${MACRO.ISSUES_EXPLAINER}`,
  ]

  return [`# Doing tasks`, ...prependBullets(items)].join(`\n`)
}

function getActionsSection(): string {
  return `# Actions
Confirm with the user before destructive/hard-to-reverse/shared-state actions (force-push, delete branches, rm -rf, git reset --hard, posting to external services, pushing code). Local reversible actions (editing files, running tests) are fine without confirmation. Investigate obstacles rather than bypassing safety checks.`
}

function getUsingYourToolsSection(enabledTools: Set<string>): string {
  const taskToolName = [TASK_CREATE_TOOL_NAME, TODO_WRITE_TOOL_NAME].find(n =>
    enabledTools.has(n),
  )

  // In REPL mode, Read/Write/Edit/Glob/Grep/Bash/Agent are hidden from direct
  // use (REPL_ONLY_TOOLS). The "prefer dedicated tools over Bash" guidance is
  // irrelevant — REPL's own prompt covers how to call them from scripts.
  if (isReplModeEnabled()) {
    const items = [
      taskToolName
        ? `Use ${taskToolName} to track progress. Mark tasks completed as you finish them.`
        : null,
    ].filter(item => item !== null)
    if (items.length === 0) return ''
    return [`# Using your tools`, ...prependBullets(items)].join(`\n`)
  }

  // Ant-native builds alias find/grep to embedded bfs/ugrep and remove the
  // dedicated Glob/Grep tools, so skip guidance pointing at them.
  const embedded = hasEmbeddedSearchTools()

  const providedToolSubitems = [
    `${FILE_READ_TOOL_NAME} (not cat/head/tail), ${FILE_EDIT_TOOL_NAME} (not sed/awk), ${FILE_WRITE_TOOL_NAME} (not echo/heredoc)`,
    ...(embedded
      ? []
      : [
          `${GLOB_TOOL_NAME} (not find/ls), ${GREP_TOOL_NAME} (not grep/rg)`,
        ]),
    `${BASH_TOOL_NAME} only for system commands that have no dedicated tool`,
  ]

  const items = [
    `Use dedicated tools instead of ${BASH_TOOL_NAME}:`,
    providedToolSubitems,
    taskToolName
      ? `Use ${taskToolName} to track progress. Mark tasks completed as you finish them.`
      : null,
    `Call independent tools in parallel. Sequential only when there are dependencies.`,
  ].filter(item => item !== null)

  return [`# Using your tools`, ...prependBullets(items)].join(`\n`)
}

function getAgentToolSection(): string {
  return isForkSubagentEnabled()
    ? `${AGENT_TOOL_NAME} without subagent_type creates a background fork. Use for research or multi-step work that would fill your context. If you ARE the fork — execute directly, don't re-delegate.`
    : `Use ${AGENT_TOOL_NAME} for specialized agents. Don't duplicate work subagents are doing.`
}

/**
 * Guidance for the skill_discovery attachment ("Skills relevant to your
 * task:") and the DiscoverSkills tool. Shared between the main-session
 * getUsingYourToolsSection bullet and the subagent path in
 * enhanceSystemPromptWithEnvDetails — subagents receive skill_discovery
 * attachments (post #22830) but don't go through getSystemPrompt, so
 * without this they'd see the reminders with no framing.
 *
 * feature() guard is internal — external builds DCE the string literal
 * along with the DISCOVER_SKILLS_TOOL_NAME interpolation.
 */
function getDiscoverSkillsGuidance(): string | null {
  if (
    feature('EXPERIMENTAL_SKILL_SEARCH') &&
    DISCOVER_SKILLS_TOOL_NAME !== null
  ) {
    return `Relevant skills are automatically surfaced each turn as "Skills relevant to your task:" reminders. If you're about to do something those don't cover — a mid-task pivot, an unusual workflow, a multi-step plan — call ${DISCOVER_SKILLS_TOOL_NAME} with a specific description of what you're doing. Skills already visible or loaded are filtered automatically. Skip this if the surfaced skills already cover your next action.`
  }
  return null
}

/**
 * Session-variant guidance that would fragment the cacheScope:'global'
 * prefix if placed before SYSTEM_PROMPT_DYNAMIC_BOUNDARY. Each conditional
 * here is a runtime bit that would otherwise multiply the Blake2b prefix
 * hash variants (2^N). See PR #24490, #24171 for the same bug class.
 *
 * outputStyleConfig intentionally NOT moved here — identity framing lives
 * in the static intro pending eval.
 */
function getSessionSpecificGuidanceSection(
  enabledTools: Set<string>,
  skillToolCommands: Command[],
): string | null {
  const hasAskUserQuestionTool = enabledTools.has(ASK_USER_QUESTION_TOOL_NAME)
  const hasSkills =
    skillToolCommands.length > 0 && enabledTools.has(SKILL_TOOL_NAME)
  const hasAgentTool = enabledTools.has(AGENT_TOOL_NAME)
  const searchTools = hasEmbeddedSearchTools()
    ? `\`find\` or \`grep\` via the ${BASH_TOOL_NAME} tool`
    : `the ${GLOB_TOOL_NAME} or ${GREP_TOOL_NAME}`

  const items = [
    getIsNonInteractiveSession()
      ? null
      : `User can run shell commands with \`! <command>\` in the prompt.`,
    // isForkSubagentEnabled() reads getIsNonInteractiveSession() — must be
    // post-boundary or it fragments the static prefix on session type.
    hasAgentTool ? getAgentToolSection() : null,
    ...(hasAgentTool &&
    areExplorePlanAgentsEnabled() &&
    !isForkSubagentEnabled()
      ? [
          `For simple, directed codebase searches (e.g. for a specific file/class/function) use ${searchTools} directly.`,
          `For broader codebase exploration and deep research, use the ${AGENT_TOOL_NAME} tool with subagent_type=${EXPLORE_AGENT.agentType}. This is slower than using ${searchTools} directly, so use this only when a simple, directed search proves to be insufficient or when your task will clearly require more than ${EXPLORE_AGENT_MIN_QUERIES} queries.`,
        ]
      : []),
    hasSkills
      ? `/<skill-name> invokes skills via ${SKILL_TOOL_NAME}. Only use skills listed in its user-invocable section.`
      : null,
    // [fast-code] DISCOVER_SKILLS removed (feature flag off)
    // [fast-code] VERIFICATION_AGENT is ant-only A/B, removed
  ].filter(item => item !== null)

  if (items.length === 0) return null
  return ['# Session-specific guidance', ...prependBullets(items)].join('\n')
}

// @[MODEL LAUNCH]: Remove this section when we launch numbat.
function getOutputEfficiencySection(): string {
  return `# Output
Be concise. Lead with the answer, not the reasoning. Skip filler and preamble. One sentence over three.`
}

function getSimpleToneAndStyleSection(): string {
  const items = [
    `No emojis unless explicitly requested.`,
    `Reference code as file_path:line_number. Reference PRs/issues as owner/repo#123.`,
  ]

  return [`# Tone`, ...prependBullets(items)].join(`\n`)
}

export async function getSystemPrompt(
  tools: Tools,
  model: string,
  additionalWorkingDirectories?: string[],
  mcpClients?: MCPServerConnection[],
): Promise<string[]> {
  if (isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)) {
    return [
      `You are Fast Code, a CLI for Claude.\n\nCWD: ${getCwd()}\nDate: ${getSessionStartDate()}`,
    ]
  }

  const cwd = getCwd()
  const [skillToolCommands, outputStyleConfig, envInfo] = await Promise.all([
    getSkillToolCommands(cwd),
    getOutputStyleConfig(),
    computeSimpleEnvInfo(model, additionalWorkingDirectories),
  ])

  const settings = getInitialSettings()
  const enabledTools = new Set(tools.map(_ => _.name))

  if (
    (feature('PROACTIVE') || feature('KAIROS')) &&
    proactiveModule?.isProactiveActive()
  ) {
    logForDebugging(`[SystemPrompt] path=simple-proactive`)
    return [
      `\nYou are an autonomous agent. Use tools to do useful work.\n\n${CYBER_RISK_INSTRUCTION}`,
      getSystemRemindersSection(),
      await loadMemoryPrompt(),
      envInfo,
      getLanguageSection(settings.language),
      // When delta enabled, instructions are announced via persisted
      // mcp_instructions_delta attachments (attachments.ts) instead.
      isMcpInstructionsDeltaEnabled()
        ? null
        : getMcpInstructionsSection(mcpClients),
      getScratchpadInstructions(),
      getFunctionResultClearingSection(model),
      SUMMARIZE_TOOL_RESULTS_SECTION,
      getProactiveSection(),
    ].filter(s => s !== null)
  }

  const dynamicSections = [
    systemPromptSection('session_guidance', () =>
      getSessionSpecificGuidanceSection(enabledTools, skillToolCommands),
    ),
    systemPromptSection('memory', () => loadMemoryPrompt()),
    // [fast-code] ant_model_override removed (always null for external)
    systemPromptSection('env_info_simple', () =>
      computeSimpleEnvInfo(model, additionalWorkingDirectories),
    ),
    systemPromptSection('language', () =>
      getLanguageSection(settings.language),
    ),
    systemPromptSection('output_style', () =>
      getOutputStyleSection(outputStyleConfig),
    ),
    // When delta enabled, instructions are announced via persisted
    // mcp_instructions_delta attachments (attachments.ts) instead of this
    // per-turn recompute, which busts the prompt cache on late MCP connect.
    // Gate check inside compute (not selecting between section variants)
    // so a mid-session gate flip doesn't read a stale cached value.
    DANGEROUS_uncachedSystemPromptSection(
      'mcp_instructions',
      () =>
        isMcpInstructionsDeltaEnabled()
          ? null
          : getMcpInstructionsSection(mcpClients),
      'MCP servers connect/disconnect between turns',
    ),
    systemPromptSection('scratchpad', () => getScratchpadInstructions()),
    systemPromptSection('frc', () => getFunctionResultClearingSection(model)),
    systemPromptSection(
      'summarize_tool_results',
      () => SUMMARIZE_TOOL_RESULTS_SECTION,
    ),
    // [fast-code] numeric_length_anchors removed (ant-only)
    // [fast-code] TOKEN_BUDGET and KAIROS removed (feature flags off)
  ]

  const resolvedDynamicSections =
    await resolveSystemPromptSections(dynamicSections)

  return [
    // --- Static content (cacheable) ---
    getSimpleIntroSection(outputStyleConfig),
    getSimpleSystemSection(),
    outputStyleConfig === null ||
    outputStyleConfig.keepCodingInstructions === true
      ? getSimpleDoingTasksSection()
      : null,
    getActionsSection(),
    getUsingYourToolsSection(enabledTools),
    getSimpleToneAndStyleSection(),
    getOutputEfficiencySection(),
    // === BOUNDARY MARKER - DO NOT MOVE OR REMOVE ===
    ...(shouldUseGlobalCacheScope() ? [SYSTEM_PROMPT_DYNAMIC_BOUNDARY] : []),
    // --- Dynamic content (registry-managed) ---
    ...resolvedDynamicSections,
  ].filter(s => s !== null)
}

function getMcpInstructions(mcpClients: MCPServerConnection[]): string | null {
  const connectedClients = mcpClients.filter(
    (client): client is ConnectedMCPServer => client.type === 'connected',
  )

  const clientsWithInstructions = connectedClients.filter(
    client => client.instructions,
  )

  if (clientsWithInstructions.length === 0) {
    return null
  }

  const instructionBlocks = clientsWithInstructions
    .map(client => {
      return `## ${client.name}
${client.instructions}`
    })
    .join('\n\n')

  return `# MCP Server Instructions

The following MCP servers have provided instructions for how to use their tools and resources:

${instructionBlocks}`
}

export async function computeEnvInfo(
  modelId: string,
  additionalWorkingDirectories?: string[],
): Promise<string> {
  const [isGit, unameSR] = await Promise.all([getIsGit(), getUnameSR()])

  // Undercover: keep ALL model names/IDs out of the system prompt so nothing
  // internal can leak into public commits/PRs. This includes the public
  // FRONTIER_MODEL_* constants — if those ever point at an unannounced model,
  // we don't want them in context. Go fully dark.
  //
  // DCE: `process.env.USER_TYPE === 'ant'` is build-time --define. It MUST be
  // inlined at each callsite (not hoisted to a const) so the bundler can
  // constant-fold it to `false` in external builds and eliminate the branch.
  let modelDescription = ''
  if (process.env.USER_TYPE === 'ant' && isUndercover()) {
    // suppress
  } else {
    const marketingName = getMarketingNameForModel(modelId)
    modelDescription = marketingName
      ? `You are powered by the model named ${marketingName}. The exact model ID is ${modelId}.`
      : `You are powered by the model ${modelId}.`
  }

  const additionalDirsInfo =
    additionalWorkingDirectories && additionalWorkingDirectories.length > 0
      ? `Additional working directories: ${additionalWorkingDirectories.join(', ')}\n`
      : ''

  const cutoff = getKnowledgeCutoff(modelId)
  const knowledgeCutoffMessage = cutoff
    ? `\n\nAssistant knowledge cutoff is ${cutoff}.`
    : ''

  return `<env>
CWD: ${getCwd()} | Git: ${isGit ? 'Yes' : 'No'} | ${env.platform} | ${unameSR}
${additionalDirsInfo}</env>
${modelDescription}${knowledgeCutoffMessage}`
}

export async function computeSimpleEnvInfo(
  modelId: string,
  additionalWorkingDirectories?: string[],
): Promise<string> {
  const [isGit, unameSR] = await Promise.all([getIsGit(), getUnameSR()])

  // Undercover: strip all model name/ID references. See computeEnvInfo.
  // DCE: inline the USER_TYPE check at each site — do NOT hoist to a const.
  let modelDescription: string | null = null
  if (process.env.USER_TYPE === 'ant' && isUndercover()) {
    // suppress
  } else {
    const marketingName = getMarketingNameForModel(modelId)
    modelDescription = marketingName
      ? `You are powered by the model named ${marketingName}. The exact model ID is ${modelId}.`
      : `You are powered by the model ${modelId}.`
  }

  const cutoff = getKnowledgeCutoff(modelId)
  const knowledgeCutoffMessage = cutoff
    ? `Assistant knowledge cutoff is ${cutoff}.`
    : null

  const cwd = getCwd()
  const isWorktree = getCurrentWorktreeSession() !== null

  const envItems = [
    `CWD: ${cwd} | Git: ${isGit} | ${env.platform} | ${getShellInfoLine()} | ${unameSR}`,
    isWorktree ? `Git worktree — run commands from this directory only.` : null,
    additionalWorkingDirectories && additionalWorkingDirectories.length > 0
      ? `Extra dirs: ${additionalWorkingDirectories.join(', ')}`
      : null,
    modelDescription,
    knowledgeCutoffMessage,
  ].filter(item => item !== null)

  return envItems.join(`\n`)
}

// @[MODEL LAUNCH]: Add a knowledge cutoff date for the new model.
function getKnowledgeCutoff(modelId: string): string | null {
  const canonical = getCanonicalName(modelId)
  if (canonical.includes('claude-sonnet-4-6')) {
    return 'August 2025'
  } else if (canonical.includes('claude-opus-4-6')) {
    return 'May 2025'
  } else if (canonical.includes('claude-opus-4-5')) {
    return 'May 2025'
  } else if (canonical.includes('claude-haiku-4')) {
    return 'February 2025'
  } else if (
    canonical.includes('claude-opus-4') ||
    canonical.includes('claude-sonnet-4')
  ) {
    return 'January 2025'
  }
  return null
}

function getShellInfoLine(): string {
  const shell = process.env.SHELL || 'unknown'
  const shellName = shell.includes('zsh')
    ? 'zsh'
    : shell.includes('bash')
      ? 'bash'
      : shell
  if (env.platform === 'win32') {
    return `Shell: ${shellName} (use Unix shell syntax, not Windows — e.g., /dev/null not NUL, forward slashes in paths)`
  }
  return `Shell: ${shellName}`
}

export function getUnameSR(): string {
  // os.type() and os.release() both wrap uname(3) on POSIX, producing output
  // byte-identical to `uname -sr`: "Darwin 25.3.0", "Linux 6.6.4", etc.
  // Windows has no uname(3); os.type() returns "Windows_NT" there, but
  // os.version() gives the friendlier "Windows 11 Pro" (via GetVersionExW /
  // RtlGetVersion) so use that instead. Feeds the OS Version line in the
  // system prompt env section.
  if (env.platform === 'win32') {
    return `${osVersion()} ${osRelease()}`
  }
  return `${osType()} ${osRelease()}`
}

export const DEFAULT_AGENT_PROMPT = `You are an agent for Fast Code. Use tools to complete the task fully. Respond with a concise report of what was done and key findings.`

export async function enhanceSystemPromptWithEnvDetails(
  existingSystemPrompt: string[],
  model: string,
  additionalWorkingDirectories?: string[],
  enabledToolNames?: ReadonlySet<string>,
): Promise<string[]> {
  const notes = `Notes:
- Use absolute file paths only (cwd resets between bash calls).
- Share relevant file paths in final response. Only include code snippets when load-bearing.
- No emojis.`
  // Subagents get skill_discovery attachments (prefetch.ts runs in query(),
  // no agentId guard since #22830) but don't go through getSystemPrompt —
  // surface the same DiscoverSkills framing the main session gets. Gated on
  // enabledToolNames when the caller provides it (runAgent.ts does).
  // AgentTool.tsx:768 builds the prompt before assembleToolPool:830 so it
  // omits this param — `?? true` preserves guidance there.
  const discoverSkillsGuidance =
    feature('EXPERIMENTAL_SKILL_SEARCH') &&
    skillSearchFeatureCheck?.isSkillSearchEnabled() &&
    DISCOVER_SKILLS_TOOL_NAME !== null &&
    (enabledToolNames?.has(DISCOVER_SKILLS_TOOL_NAME) ?? true)
      ? getDiscoverSkillsGuidance()
      : null
  const envInfo = await computeEnvInfo(model, additionalWorkingDirectories)
  return [
    ...existingSystemPrompt,
    notes,
    ...(discoverSkillsGuidance !== null ? [discoverSkillsGuidance] : []),
    envInfo,
  ]
}

/**
 * Returns instructions for using the scratchpad directory if enabled.
 * The scratchpad is a per-session directory where Claude can write temporary files.
 */
export function getScratchpadInstructions(): string | null {
  if (!isScratchpadEnabled()) {
    return null
  }

  const scratchpadDir = getScratchpadDir()

  return `# Scratchpad
Use \`${scratchpadDir}\` for all temporary files instead of \`/tmp\`. Session-specific, no permission prompts needed.`
}

function getFunctionResultClearingSection(model: string): string | null {
  if (!feature('CACHED_MICROCOMPACT') || !getCachedMCConfigForFRC) {
    return null
  }
  const config = getCachedMCConfigForFRC()
  const isModelSupported = config.supportedModels?.some(pattern =>
    model.includes(pattern),
  )
  if (
    !config.enabled ||
    !config.systemPromptSuggestSummaries ||
    !isModelSupported
  ) {
    return null
  }
  return `Old tool results are auto-cleared from context. The ${config.keepRecent} most recent are kept.`
}

const SUMMARIZE_TOOL_RESULTS_SECTION = `Note important info from tool results in your response — originals may be cleared.`

function getBriefSection(): string | null {
  if (!(feature('KAIROS') || feature('KAIROS_BRIEF'))) return null
  if (!BRIEF_PROACTIVE_SECTION) return null
  // Whenever the tool is available, the model is told to use it. The
  // /brief toggle and --brief flag now only control the isBriefOnly
  // display filter — they no longer gate model-facing behavior.
  if (!briefToolModule?.isBriefEnabled()) return null
  // When proactive is active, getProactiveSection() already appends the
  // section inline. Skip here to avoid duplicating it in the system prompt.
  if (
    (feature('PROACTIVE') || feature('KAIROS')) &&
    proactiveModule?.isProactiveActive()
  )
    return null
  return BRIEF_PROACTIVE_SECTION
}

function getProactiveSection(): string | null {
  if (!(feature('PROACTIVE') || feature('KAIROS'))) return null
  if (!proactiveModule?.isProactiveActive()) return null

  return `# Autonomous work

You run autonomously. \`<${TICK_TAG}>\` prompts keep you alive — process the latest one. Time in ticks is user's local time.

If nothing to do on a tick, call ${SLEEP_TOOL_NAME} immediately — no "still waiting" messages. First tick: greet briefly and ask what to work on.

Act on your best judgment — read files, run tests, make changes, commit at good stopping points. Don't narrate steps. Be concise: only surface decisions needing input, milestones, or blockers.

\`terminalFocus\`: unfocused = more autonomous, focused = more collaborative.${BRIEF_PROACTIVE_SECTION && briefToolModule?.isBriefEnabled() ? `\n\n${BRIEF_PROACTIVE_SECTION}` : ''}`
}
