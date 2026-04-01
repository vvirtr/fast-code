// [fast-code] ant-only, stubbed — mock rate limits are internal-only testing tools.
// All exports are no-ops for external builds. Function signatures preserved for callers.

import type { SubscriptionType } from '../services/oauth/types.js'

type MockHeaders = Record<string, string>

export type MockHeaderKey =
  | 'status'
  | 'reset'
  | 'claim'
  | 'overage-status'
  | 'overage-reset'
  | 'overage-disabled-reason'
  | 'fallback'
  | 'fallback-percentage'
  | 'retry-after'
  | '5h-utilization'
  | '5h-reset'
  | '5h-surpassed-threshold'
  | '7d-utilization'
  | '7d-reset'
  | '7d-surpassed-threshold'

export type MockScenario =
  | 'normal'
  | 'session-limit-reached'
  | 'approaching-weekly-limit'
  | 'weekly-limit-reached'
  | 'overage-active'
  | 'overage-warning'
  | 'overage-exhausted'
  | 'out-of-credits'
  | 'org-zero-credit-limit'
  | 'org-spend-cap-hit'
  | 'member-zero-credit-limit'
  | 'seat-tier-zero-credit-limit'
  | 'opus-limit'
  | 'opus-warning'
  | 'sonnet-limit'
  | 'sonnet-warning'
  | 'fast-mode-limit'
  | 'fast-mode-short-limit'
  | 'extra-usage-required'
  | 'clear'

export function setMockHeader(
  _key: MockHeaderKey,
  _value: string | undefined,
): void {}

export function addExceededLimit(
  _type: 'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet',
  _hoursFromNow: number,
): void {}

export function setMockEarlyWarning(
  _claimAbbrev: '5h' | '7d' | 'overage',
  _utilization: number,
  _hoursFromNow?: number,
): void {}

export function clearMockEarlyWarning(): void {}

export function setMockRateLimitScenario(_scenario: MockScenario): void {}

export function getMockHeaderless429Message(): string | null {
  return null
}

export function getMockHeaders(): MockHeaders | null {
  return null
}

export function getMockStatus(): string {
  return 'No mock headers active (using real limits)'
}

export function clearMockHeaders(): void {}

export function applyMockHeaders(
  headers: globalThis.Headers,
): globalThis.Headers {
  return headers
}

export function shouldProcessMockLimits(): boolean {
  return false
}

export function getCurrentMockScenario(): MockScenario | null {
  return null
}

export function getScenarioDescription(scenario: MockScenario): string {
  return scenario === 'clear'
    ? 'Clear mock headers (use real limits)'
    : 'Unknown scenario'
}

export function setMockSubscriptionType(
  _subscriptionType: SubscriptionType | null,
): void {}

export function getMockSubscriptionType(): SubscriptionType | null {
  return null
}

export function shouldUseMockSubscription(): boolean {
  return false
}

export function setMockBillingAccess(_hasAccess: boolean | null): void {}

export function isMockFastModeRateLimitScenario(): boolean {
  return false
}

export function checkMockFastModeRateLimit(
  _isFastModeActive?: boolean,
): MockHeaders | null {
  return null
}
