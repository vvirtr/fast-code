/**
 * Setup utilities for integrating KeybindingProvider into the app.
 *
 * User keybinding customization and chord sequences have been removed.
 * This file provides a simple provider that loads the hardcoded default
 * bindings and exposes them to the component tree.
 */
import React, { useCallback, useRef, useState } from 'react';
import { KeybindingProvider } from './KeybindingContext.js';
import { type KeybindingsLoadResult, loadKeybindingsSyncWithWarnings } from './loadUserBindings.js';
import type { KeybindingContextName, ParsedKeystroke } from './types.js';

type Props = {
  children: React.ReactNode;
};

/**
 * Keybinding provider with hardcoded default bindings.
 *
 * Usage: Wrap your app with this provider to enable keybinding support.
 *
 * ```tsx
 * <AppStateProvider>
 *   <KeybindingSetup>
 *     <REPL ... />
 *   </KeybindingSetup>
 * </AppStateProvider>
 * ```
 */

type HandlerRegistration = {
  action: string;
  context: KeybindingContextName;
  handler: () => void;
};

export function KeybindingSetup({
  children
}: Props): React.ReactNode {
  // Load bindings synchronously for initial render
  const [{
    bindings,
  }] = useState<KeybindingsLoadResult>(() => {
    return loadKeybindingsSyncWithWarnings();
  });

  // Chord state stubs — chord sequences removed but KeybindingProvider
  // still expects these props for backward compatibility
  const pendingChordRef = useRef<ParsedKeystroke[] | null>(null);
  const [pendingChord] = useState<ParsedKeystroke[] | null>(null);
  const setPendingChord = useCallback((_pending: ParsedKeystroke[] | null) => {}, []);

  // Handler registry for action callbacks
  const handlerRegistryRef = useRef(new Map<string, Set<HandlerRegistration>>());

  // Active context tracking for keybinding priority resolution
  const activeContextsRef = useRef<Set<KeybindingContextName>>(new Set());
  const registerActiveContext = useCallback((context: KeybindingContextName) => {
    activeContextsRef.current.add(context);
  }, []);
  const unregisterActiveContext = useCallback((context_0: KeybindingContextName) => {
    activeContextsRef.current.delete(context_0);
  }, []);

  return <KeybindingProvider bindings={bindings} pendingChordRef={pendingChordRef} pendingChord={pendingChord} setPendingChord={setPendingChord} activeContexts={activeContextsRef.current} registerActiveContext={registerActiveContext} unregisterActiveContext={unregisterActiveContext} handlerRegistryRef={handlerRegistryRef}>
      {children}
    </KeybindingProvider>;
}
