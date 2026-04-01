/**
 * Undercover mode — safety utilities for contributing to public/open-source repos.
 *
 * [fast-code] ant-only, stubbed — all functions return trivial values for external builds.
 * In external builds USER_TYPE is never 'ant', so undercover mode is always inactive.
 * Function signatures preserved for callers.
 */

export function isUndercover(): boolean {
  return false
}

export function getUndercoverInstructions(): string {
  return ''
}

export function shouldShowUndercoverAutoNotice(): boolean {
  return false
}
