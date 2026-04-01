import * as React from 'react';
import { Box, Text } from '../../ink.js';

// [fast-code] Lightning bolt replaces Clawd mascot
export type ClawdPose = 'default' | 'arms-up' | 'look-left' | 'look-right';

type Props = {
  pose?: ClawdPose;
};

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text color="claude">{"  ▓▓▓"}</Text>
      <Text color="claude">{" ▓▓"}</Text>
      <Text color="claude">{"████"}</Text>
      <Text color="claude">{"  ▓▓"}</Text>
      <Text color="claude">{" ▓"}</Text>
    </Box>
  );
}
