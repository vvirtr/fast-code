import chalk from 'chalk'
import type { Color, TextStyles } from './styles.js'

/**
 * xterm.js (VS Code, Cursor, code-server, Coder) has supported truecolor
 * since 2017, but code-server/Coder containers often don't set
 * COLORTERM=truecolor. chalk's supports-color doesn't recognize
 * TERM_PROGRAM=vscode (it only knows iTerm.app/Apple_Terminal), so it falls
 * through to the -256color regex → level 2. At level 2, chalk.rgb()
 * downgrades to the nearest 6×6×6 cube color: rgb(215,119,87) (Claude
 * orange) → idx 174 rgb(215,135,135) — washed-out salmon.
 *
 * Gated on level === 2 (not < 3) to respect NO_COLOR / FORCE_COLOR=0 —
 * those yield level 0 and are an explicit "no colors" request. Desktop VS
 * Code sets COLORTERM=truecolor itself, so this is a no-op there (already 3).
 *
 * Must run BEFORE the tmux clamp — if tmux is running inside a VS Code
 * terminal, tmux's passthrough limitation wins and we want level 2.
 */
function boostChalkLevelForXtermJs(): boolean {
  if (process.env.TERM_PROGRAM === 'vscode' && chalk.level === 2) {
    chalk.level = 3
    return true
  }
  return false
}

/**
 * tmux parses truecolor SGR (\e[48;2;r;g;bm) into its cell buffer correctly,
 * but its client-side emitter only re-emits truecolor to the outer terminal if
 * the outer terminal advertises Tc/RGB capability (via terminal-overrides).
 * Default tmux config doesn't set this, so tmux emits the cell to iTerm2/etc
 * WITHOUT the bg sequence — outer terminal's buffer has bg=default → black on
 * dark profiles. Clamping to level 2 makes chalk emit 256-color (\e[48;5;Nm),
 * which tmux passes through cleanly. grey93 (255) is visually identical to
 * rgb(240,240,240).
 *
 * Users who HAVE set `terminal-overrides ,*:Tc` get a technically-unnecessary
 * downgrade, but the visual difference is imperceptible. Querying
 * `tmux show -gv terminal-overrides` to detect this would add a subprocess on
 * startup — not worth it.
 *
 * $TMUX is a pty-lifecycle env var set by tmux itself; it never comes from
 * globalSettings.env, so reading it here is correct. chalk is a singleton, so
 * this clamps ALL truecolor output (fg+bg+hex) across the entire app.
 */
function clampChalkLevelForTmux(): boolean {
  // bg.ts sets terminal-overrides :Tc before attach, so truecolor passes
  // through — skip the clamp. General escape hatch for anyone who's
  // configured their tmux correctly.
  if (process.env.CLAUDE_CODE_TMUX_TRUECOLOR) return false
  if (process.env.TMUX && chalk.level > 2) {
    chalk.level = 2
    return true
  }
  return false
}
// Computed once at module load — terminal/tmux environment doesn't change mid-session.
// Order matters: boost first so the tmux clamp can re-clamp if tmux is running
// inside a VS Code terminal. Exported for debugging — tree-shaken if unused.
export const CHALK_BOOSTED_FOR_XTERMJS = boostChalkLevelForXtermJs()
export const CHALK_CLAMPED_FOR_TMUX = clampChalkLevelForTmux()

export type ColorType = 'foreground' | 'background'

const RGB_REGEX = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/
const ANSI_REGEX = /^ansi256\(\s?(\d+)\s?\)$/

/**
 * Cache of color string -> pre-built chalk styling functions.
 * Themes use ~147 unique color strings, but colorize() is called 100-500 times
 * per frame. Caching avoids repeated regex parsing and chalk function
 * construction on every call.
 */
const colorCache = new Map<
  string,
  { fg: (s: string) => string; bg: (s: string) => string }
>()

// Pre-built mapping from ansi color name to chalk fg/bg functions.
// Avoids the switch dispatch on every call for named ANSI colors.
const ANSI_COLOR_MAP: Record<
  string,
  { fg: (s: string) => string; bg: (s: string) => string } | undefined
> = {
  black: { fg: chalk.black, bg: chalk.bgBlack },
  red: { fg: chalk.red, bg: chalk.bgRed },
  green: { fg: chalk.green, bg: chalk.bgGreen },
  yellow: { fg: chalk.yellow, bg: chalk.bgYellow },
  blue: { fg: chalk.blue, bg: chalk.bgBlue },
  magenta: { fg: chalk.magenta, bg: chalk.bgMagenta },
  cyan: { fg: chalk.cyan, bg: chalk.bgCyan },
  white: { fg: chalk.white, bg: chalk.bgWhite },
  blackBright: { fg: chalk.blackBright, bg: chalk.bgBlackBright },
  redBright: { fg: chalk.redBright, bg: chalk.bgRedBright },
  greenBright: { fg: chalk.greenBright, bg: chalk.bgGreenBright },
  yellowBright: { fg: chalk.yellowBright, bg: chalk.bgYellowBright },
  blueBright: { fg: chalk.blueBright, bg: chalk.bgBlueBright },
  magentaBright: { fg: chalk.magentaBright, bg: chalk.bgMagentaBright },
  cyanBright: { fg: chalk.cyanBright, bg: chalk.bgCyanBright },
  whiteBright: { fg: chalk.whiteBright, bg: chalk.bgWhiteBright },
}

/**
 * Build the {fg, bg} function pair for a given color string, or return
 * undefined if the color string is not recognized (caller returns str as-is).
 */
function buildColorFns(
  color: string,
): { fg: (s: string) => string; bg: (s: string) => string } | undefined {
  if (color.startsWith('ansi:')) {
    const value = color.substring('ansi:'.length)
    return ANSI_COLOR_MAP[value]
  }

  if (color.startsWith('#')) {
    return { fg: chalk.hex(color), bg: chalk.bgHex(color) }
  }

  if (color.startsWith('ansi256')) {
    const matches = ANSI_REGEX.exec(color)
    if (!matches) {
      return undefined
    }
    const value = Number(matches[1])
    return { fg: chalk.ansi256(value), bg: chalk.bgAnsi256(value) }
  }

  if (color.startsWith('rgb')) {
    const matches = RGB_REGEX.exec(color)
    if (!matches) {
      return undefined
    }
    const r = Number(matches[1])
    const g = Number(matches[2])
    const b = Number(matches[3])
    return { fg: chalk.rgb(r, g, b), bg: chalk.bgRgb(r, g, b) }
  }

  return undefined
}

export const colorize = (
  str: string,
  color: string | undefined,
  type: ColorType,
): string => {
  if (!color) {
    return str
  }

  // Fast path: reuse cached chalk functions (avoids regex + chalk construction).
  let fns = colorCache.get(color)
  if (!fns) {
    fns = buildColorFns(color)
    if (!fns) {
      return str
    }
    colorCache.set(color, fns)
  }

  return type === 'foreground' ? fns.fg(str) : fns.bg(str)
}

/**
 * Apply TextStyles to a string using chalk.
 * This is the inverse of parsing ANSI codes - we generate them from structured styles.
 * Theme resolution happens at component layer, not here.
 */
export function applyTextStyles(text: string, styles: TextStyles): string {
  let result = text

  // Apply styles in reverse order of desired nesting.
  // chalk wraps text so later calls become outer wrappers.
  // Desired order (outermost to innermost):
  //   background > foreground > text modifiers
  // So we apply: text modifiers first, then foreground, then background last.

  if (styles.inverse) {
    result = chalk.inverse(result)
  }

  if (styles.strikethrough) {
    result = chalk.strikethrough(result)
  }

  if (styles.underline) {
    result = chalk.underline(result)
  }

  if (styles.italic) {
    result = chalk.italic(result)
  }

  if (styles.bold) {
    result = chalk.bold(result)
  }

  if (styles.dim) {
    result = chalk.dim(result)
  }

  if (styles.color) {
    // Color is now always a raw color value (theme resolution happens at component layer)
    result = colorize(result, styles.color, 'foreground')
  }

  if (styles.backgroundColor) {
    // backgroundColor is now always a raw color value
    result = colorize(result, styles.backgroundColor, 'background')
  }

  return result
}

/**
 * Apply a raw color value to text.
 * Theme resolution should happen at component layer, not here.
 */
export function applyColor(text: string, color: Color | undefined): string {
  if (!color) {
    return text
  }
  return colorize(text, color, 'foreground')
}
