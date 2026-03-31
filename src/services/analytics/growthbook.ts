// [fast-code] GrowthBook SDK fully stubbed — no HTTP requests, no SDK initialization.
// All feature value functions return defaults immediately.

import { isEqual } from '../../utils/lodashNative.js'
import {
  getGlobalConfig,
  saveGlobalConfig,
} from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'
import { createSignal } from '../../utils/signal.js'
import {
  type GitHubActionsMetadata,
} from '../../utils/user.js'

/**
 * User attributes sent to GrowthBook for targeting.
 * Uses UUID suffix (not Uuid) to align with GrowthBook conventions.
 */
export type GrowthBookUserAttributes = {
  id: string
  sessionId: string
  deviceID: string
  platform: 'win32' | 'darwin' | 'linux'
  apiBaseUrlHost?: string
  organizationUUID?: string
  accountUUID?: string
  userType?: string
  subscriptionType?: string
  rateLimitTier?: string
  firstTokenTime?: number
  email?: string
  appVersion?: string
  github?: GitHubActionsMetadata
}

// Refresh signal — kept so onGrowthBookRefresh / setGrowthBookConfigOverride
// callers still compile. No automatic emissions since there's no SDK.
type GrowthBookRefreshListener = () => void | Promise<void>
const refreshed = createSignal()

/** Call a listener with sync-throw and async-rejection both routed to logError. */
function callSafe(listener: GrowthBookRefreshListener): void {
  try {
    void Promise.resolve(listener()).catch(e => {
      logError(e)
    })
  } catch (e) {
    logError(e)
  }
}

/**
 * Register a callback to fire when GrowthBook feature values refresh.
 * Returns an unsubscribe function.
 */
export function onGrowthBookRefresh(
  listener: GrowthBookRefreshListener,
): () => void {
  const unsubscribe = refreshed.subscribe(() => callSafe(listener))
  return () => {
    unsubscribe()
  }
}

// ---- env / config override helpers (kept for /config Gates tab & eval harnesses) ----

let envOverrides: Record<string, unknown> | null = null
let envOverridesParsed = false

function getEnvOverrides(): Record<string, unknown> | null {
  if (!envOverridesParsed) {
    envOverridesParsed = true
    if (process.env.USER_TYPE === 'ant') {
      const raw = process.env.CLAUDE_INTERNAL_FC_OVERRIDES
      if (raw) {
        try {
          envOverrides = JSON.parse(raw) as Record<string, unknown>
          logForDebugging(
            `GrowthBook: Using env var overrides for ${Object.keys(envOverrides!).length} features: ${Object.keys(envOverrides!).join(', ')}`,
          )
        } catch {
          logError(
            new Error(
              `GrowthBook: Failed to parse CLAUDE_INTERNAL_FC_OVERRIDES: ${raw}`,
            ),
          )
        }
      }
    }
  }
  return envOverrides
}

export function hasGrowthBookEnvOverride(feature: string): boolean {
  const overrides = getEnvOverrides()
  return overrides !== null && feature in overrides
}

function getConfigOverrides(): Record<string, unknown> | undefined {
  if (process.env.USER_TYPE !== 'ant') return undefined
  try {
    return getGlobalConfig().growthBookOverrides
  } catch {
    return undefined
  }
}

export function getAllGrowthBookFeatures(): Record<string, unknown> {
  return getGlobalConfig().cachedGrowthBookFeatures ?? {}
}

export function getGrowthBookConfigOverrides(): Record<string, unknown> {
  return getConfigOverrides() ?? {}
}

export function setGrowthBookConfigOverride(
  feature: string,
  value: unknown,
): void {
  if (process.env.USER_TYPE !== 'ant') return
  try {
    saveGlobalConfig(c => {
      const current = c.growthBookOverrides ?? {}
      if (value === undefined) {
        if (!(feature in current)) return c
        const { [feature]: _, ...rest } = current
        if (Object.keys(rest).length === 0) {
          const { growthBookOverrides: __, ...configWithout } = c
          return configWithout
        }
        return { ...c, growthBookOverrides: rest }
      }
      if (isEqual(current[feature], value)) return c
      return { ...c, growthBookOverrides: { ...current, [feature]: value } }
    })
    refreshed.emit()
  } catch (e) {
    logError(e)
  }
}

export function clearGrowthBookConfigOverrides(): void {
  if (process.env.USER_TYPE !== 'ant') return
  try {
    saveGlobalConfig(c => {
      if (
        !c.growthBookOverrides ||
        Object.keys(c.growthBookOverrides).length === 0
      ) {
        return c
      }
      const { growthBookOverrides: _, ...rest } = c
      return rest
    })
    refreshed.emit()
  } catch (e) {
    logError(e)
  }
}

export function getApiBaseUrlHost(): string | undefined {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) return undefined
  try {
    const host = new URL(baseUrl).host
    if (host === 'api.anthropic.com') return undefined
    return host
  } catch {
    return undefined
  }
}

// ============================================================================
// Stubbed SDK functions — no network, no initialization, return defaults
// ============================================================================

/** [fast-code] No-op — SDK is not initialized. */
export async function initializeGrowthBook(): Promise<null> {
  return null
}

/** [fast-code] Returns defaultValue immediately — no SDK, no disk cache. */
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  _feature: string,
  defaultValue: T,
): T {
  return defaultValue
}

/** [fast-code] Returns false immediately. */
export function checkStatsigFeatureGate_CACHED_MAY_BE_STALE(
  _gate: string,
): boolean {
  return false
}

/** [fast-code] Returns false immediately. */
export async function checkGate_CACHED_OR_BLOCKING(
  _gate: string,
): Promise<boolean> {
  return false
}

/** [fast-code] Returns defaultValue immediately. */
export function getDynamicConfig_CACHED_MAY_BE_STALE<T>(
  _configName: string,
  defaultValue: T,
): T {
  return defaultValue
}

/** [fast-code] Returns defaultValue immediately. */
export function getFeatureValue_CACHED_WITH_REFRESH<T>(
  _feature: string,
  defaultValue: T,
  _refreshIntervalMs: number,
): T {
  return defaultValue
}

/** [fast-code] Returns defaultValue immediately. */
export async function getFeatureValue_DEPRECATED<T>(
  _feature: string,
  defaultValue: T,
): Promise<T> {
  return defaultValue
}

/** [fast-code] Returns false immediately. */
export async function checkSecurityRestrictionGate(
  _gate: string,
): Promise<boolean> {
  return false
}

/** [fast-code] No-op. */
export function refreshGrowthBookAfterAuthChange(): void {
  // no-op
}

/** [fast-code] No-op. */
export async function refreshGrowthBookFeatures(): Promise<void> {
  // no-op
}

/** [fast-code] No-op. */
export function setupPeriodicGrowthBookRefresh(): void {
  // no-op
}

/** [fast-code] No-op. */
export function stopPeriodicGrowthBookRefresh(): void {
  // no-op
}

/** [fast-code] No-op. */
export function resetGrowthBook(): void {
  // no-op
}

/** [fast-code] Returns defaultValue immediately. */
export async function getDynamicConfig_BLOCKS_ON_INIT<T>(
  _configName: string,
  defaultValue: T,
): Promise<T> {
  return defaultValue
}
