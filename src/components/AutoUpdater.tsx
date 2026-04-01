// [fast-code] removed: auto-updater disabled — renders null
import * as React from 'react';
import type { AutoUpdaterResult } from '../utils/autoUpdater.js';
type Props = {
  isUpdating: boolean;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  onAutoUpdaterResult: (autoUpdaterResult: AutoUpdaterResult) => void;
  autoUpdaterResult: AutoUpdaterResult | null;
  showSuccessMessage: boolean;
  verbose: boolean;
};
export function AutoUpdater(_props: Props): React.ReactNode {
  return null;
}
