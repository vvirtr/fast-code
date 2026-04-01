// [fast-code] removed: /install-github-app command disabled
import type { Command } from '../../commands.js'

const installGitHubApp = {
  type: 'local-jsx',
  name: 'install-github-app',
  description: 'Not available in Fast Code',
  availability: ['claude-ai', 'console'],
  isEnabled: () => false,
  load: () => import('./install-github-app.js'),
} satisfies Command

export default installGitHubApp
