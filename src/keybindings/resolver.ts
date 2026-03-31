import type { Key } from '../ink.js'
import { matchesBinding } from './match.js'
import { chordToString } from './parser.js'
import type {
  KeybindingContextName,
  ParsedBinding,
  ParsedKeystroke,
} from './types.js'

export type ResolveResult =
  | { type: 'match'; action: string }
  | { type: 'none' }
  | { type: 'unbound' }

/**
 * ChordResolveResult is kept for backward compatibility with consumers
 * (KeybindingContext, useKeybinding) that switch on result.type including
 * chord_started / chord_cancelled. With chords removed those branches
 * are dead code, but the type union avoids compile errors.
 */
export type ChordResolveResult =
  | { type: 'match'; action: string }
  | { type: 'none' }
  | { type: 'unbound' }
  | { type: 'chord_started'; pending: ParsedKeystroke[] }
  | { type: 'chord_cancelled' }

/**
 * Resolve a key input to an action.
 * Pure function - no state, no side effects, just matching logic.
 *
 * @param input - The character input from Ink
 * @param key - The Key object from Ink with modifier flags
 * @param activeContexts - Array of currently active contexts (e.g., ['Chat', 'Global'])
 * @param bindings - All parsed bindings to search through
 * @returns The resolution result
 */
export function resolveKey(
  input: string,
  key: Key,
  activeContexts: KeybindingContextName[],
  bindings: ParsedBinding[],
): ResolveResult {
  // Find matching bindings (last one wins for user overrides)
  let match: ParsedBinding | undefined
  const ctxSet = new Set(activeContexts)

  for (const binding of bindings) {
    // Only single-keystroke bindings (chords removed)
    if (binding.chord.length !== 1) continue
    if (!ctxSet.has(binding.context)) continue

    if (matchesBinding(input, key, binding)) {
      match = binding
    }
  }

  if (!match) {
    return { type: 'none' }
  }

  if (match.action === null) {
    return { type: 'unbound' }
  }

  return { type: 'match', action: match.action }
}

/**
 * Get display text for an action from bindings (e.g., "ctrl+t" for "app:toggleTodos").
 * Searches in reverse order so user overrides take precedence.
 */
export function getBindingDisplayText(
  action: string,
  context: KeybindingContextName,
  bindings: ParsedBinding[],
): string | undefined {
  // Find the last binding for this action in this context
  const binding = bindings.findLast(
    b => b.action === action && b.context === context,
  )
  return binding ? chordToString(binding.chord) : undefined
}

/**
 * Resolve a key with chord state support.
 *
 * Chord sequences have been removed. This function now delegates directly
 * to resolveKey and ignores the pending parameter. Retained for backward
 * compatibility with KeybindingContext and useKeybinding which call it.
 */
export function resolveKeyWithChordState(
  input: string,
  key: Key,
  activeContexts: KeybindingContextName[],
  bindings: ParsedBinding[],
  _pending: ParsedKeystroke[] | null,
): ChordResolveResult {
  return resolveKey(input, key, activeContexts, bindings)
}
