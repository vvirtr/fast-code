/**
 * Keybinding loader.
 *
 * User keybinding customization has been removed. This module now
 * always returns the hardcoded default bindings.
 */

import { DEFAULT_BINDINGS } from './defaultBindings.js'
import { parseBindings } from './parser.js'
import type { ParsedBinding } from './types.js'
import type { KeybindingWarning } from './validate.js'

/**
 * Check if keybinding customization is enabled.
 *
 * Always returns false — user customization is removed.
 */
export function isKeybindingCustomizationEnabled(): boolean {
  return false
}

/**
 * Result of loading keybindings, including any validation warnings.
 */
export type KeybindingsLoadResult = {
  bindings: ParsedBinding[]
  warnings: KeybindingWarning[]
}

/**
 * Parse default bindings (cached for performance).
 */
let cachedDefaultBindings: ParsedBinding[] | null = null
function getDefaultParsedBindings(): ParsedBinding[] {
  if (!cachedDefaultBindings) {
    cachedDefaultBindings = parseBindings(DEFAULT_BINDINGS)
  }
  return cachedDefaultBindings
}

/**
 * Get the path to the user keybindings file.
 * Retained for consumers that reference this path in UI messages.
 */
export function getKeybindingsPath(): string {
  return ''
}

/**
 * Load and parse keybindings.
 * Always returns the hardcoded default bindings.
 */
export async function loadKeybindings(): Promise<KeybindingsLoadResult> {
  return { bindings: getDefaultParsedBindings(), warnings: [] }
}

/**
 * Load keybindings synchronously (for initial render).
 */
export function loadKeybindingsSync(): ParsedBinding[] {
  return getDefaultParsedBindings()
}

/**
 * Load keybindings synchronously with validation warnings.
 * Always returns default bindings with no warnings.
 */
export function loadKeybindingsSyncWithWarnings(): KeybindingsLoadResult {
  return { bindings: getDefaultParsedBindings(), warnings: [] }
}

/**
 * Initialize file watching for keybindings.json.
 * No-op — user customization is removed.
 */
export async function initializeKeybindingWatcher(): Promise<void> {}

/**
 * Clean up the file watcher.
 * No-op — user customization is removed.
 */
export function disposeKeybindingWatcher(): void {}

/**
 * Subscribe to keybinding changes.
 * No-op — bindings never change. Returns an unsubscribe function.
 */
export const subscribeToKeybindingChanges = (
  _listener: (result: KeybindingsLoadResult) => void,
): (() => void) => {
  return () => {}
}

/**
 * Get the cached keybinding warnings.
 * Always returns empty — no user config to validate.
 */
export function getCachedKeybindingWarnings(): KeybindingWarning[] {
  return []
}

/**
 * Reset internal state for testing.
 */
export function resetKeybindingLoaderForTesting(): void {
  cachedDefaultBindings = null
}
