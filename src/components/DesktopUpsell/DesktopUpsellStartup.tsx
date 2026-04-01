// [fast-code] removed: desktop upsell dialog disabled
import * as React from 'react';
import { getDynamicConfig_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js';

type DesktopUpsellConfig = {
  enable_shortcut_tip: boolean;
  enable_startup_dialog: boolean;
};
const DESKTOP_UPSELL_DEFAULT: DesktopUpsellConfig = {
  enable_shortcut_tip: false,
  enable_startup_dialog: false
};

// [fast-code] kept: still used by tipRegistry.ts
export function getDesktopUpsellConfig(): DesktopUpsellConfig {
  return getDynamicConfig_CACHED_MAY_BE_STALE('tengu_desktop_upsell', DESKTOP_UPSELL_DEFAULT);
}

// [fast-code] removed: always returns false
export function shouldShowDesktopUpsellStartup(): boolean {
  return false;
}

type Props = {
  onDone: () => void;
};

// [fast-code] removed: renders null
export function DesktopUpsellStartup(_props: Props): React.ReactNode {
  return null;
}
