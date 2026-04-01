// [fast-code] removed: /doctor command disabled
import type { Command } from '../../commands.js'

const doctor: Command = {
  name: 'doctor',
  description: 'Not available in Fast Code',
  isEnabled: () => false,
  type: 'local-jsx',
  load: () => import('./doctor.js'),
}

export default doctor
