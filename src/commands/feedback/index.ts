import type { Command } from '../../commands.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'

const feedback = {
  aliases: ['bug'],
  type: 'local-jsx',
  name: 'feedback',
  description: `Submit feedback about Fast Code`,
  argumentHint: '[report]',
  // [fast-code] Feedback command disabled — sends data to Anthropic
  isEnabled: () => false,
  load: () => import('./feedback.js'),
} satisfies Command

export default feedback
