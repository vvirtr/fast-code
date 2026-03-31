/**
 * Keybinding validation types and stubs.
 *
 * User keybinding customization has been removed. Validation functions
 * return empty results since there are no user-provided bindings to validate.
 * Types are retained because other modules reference them.
 */

import type { ParsedBinding } from './types.js'

/**
 * Types of validation issues that can occur with keybindings.
 */
export type KeybindingWarningType =
  | 'parse_error'
  | 'duplicate'
  | 'reserved'
  | 'invalid_context'
  | 'invalid_action'

/**
 * A warning or error about a keybinding configuration issue.
 */
export type KeybindingWarning = {
  type: KeybindingWarningType
  severity: 'error' | 'warning'
  message: string
  key?: string
  context?: string
  action?: string
  suggestion?: string
}

/**
 * Detect duplicate keys within the same bindings block in a JSON string.
 * No-op — user config validation is removed.
 */
export function checkDuplicateKeysInJson(
  _jsonString: string,
): KeybindingWarning[] {
  return []
}

/**
 * Validate user keybinding config and return all warnings.
 * No-op — user config validation is removed.
 */
export function validateUserConfig(_userBlocks: unknown): KeybindingWarning[] {
  return []
}

/**
 * Check for duplicate bindings within the same context.
 * No-op — user config validation is removed.
 */
export function checkDuplicates(
  _blocks: unknown[],
): KeybindingWarning[] {
  return []
}

/**
 * Check for reserved shortcuts that may not work.
 * No-op — user config validation is removed.
 */
export function checkReservedShortcuts(
  _bindings: ParsedBinding[],
): KeybindingWarning[] {
  return []
}

/**
 * Run all validations and return combined warnings.
 * No-op — user config validation is removed.
 */
export function validateBindings(
  _userBlocks: unknown,
  _parsedBindings: ParsedBinding[],
): KeybindingWarning[] {
  return []
}

/**
 * Format a warning for display to the user.
 */
export function formatWarning(warning: KeybindingWarning): string {
  const icon = warning.severity === 'error' ? '\u2717' : '\u26A0'
  let msg = `${icon} Keybinding ${warning.severity}: ${warning.message}`
  if (warning.suggestion) {
    msg += `\n  ${warning.suggestion}`
  }
  return msg
}

/**
 * Format multiple warnings for display.
 */
export function formatWarnings(warnings: KeybindingWarning[]): string {
  if (warnings.length === 0) return ''
  return warnings.map(formatWarning).join('\n')
}
