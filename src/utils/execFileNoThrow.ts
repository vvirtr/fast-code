// This file represents useful wrappers over node:child_process
// These wrappers ease error handling and cross-platform compatbility
// By using execa, Windows automatically gets shell escaping + BAT / CMD handling

import { type ExecaError, execa } from 'execa'
import { getCwd } from '../utils/cwd.js'
import { logError } from './log.js'

export { execSyncWithDefaults_DEPRECATED } from './execFileNoThrowPortable.js'

const MS_IN_SECOND = 1000
const SECONDS_IN_MINUTE = 60

type ExecFileOptions = {
  abortSignal?: AbortSignal
  timeout?: number
  preserveOutputOnError?: boolean
  // Setting useCwd=false avoids circular dependencies during initialization
  // getCwd() -> PersistentShell -> logEvent() -> execFileNoThrow
  useCwd?: boolean
  env?: NodeJS.ProcessEnv
  stdin?: 'ignore' | 'inherit' | 'pipe'
  input?: string
}

export function execFileNoThrow(
  file: string,
  args: string[],
  options: ExecFileOptions = {
    timeout: 10 * SECONDS_IN_MINUTE * MS_IN_SECOND,
    preserveOutputOnError: true,
    useCwd: true,
  },
): Promise<{ stdout: string; stderr: string; code: number; error?: string }> {
  return execFileNoThrowWithCwd(file, args, {
    abortSignal: options.abortSignal,
    timeout: options.timeout,
    preserveOutputOnError: options.preserveOutputOnError,
    cwd: options.useCwd ? getCwd() : undefined,
    env: options.env,
    stdin: options.stdin,
    input: options.input,
  })
}

type ExecFileWithCwdOptions = {
  abortSignal?: AbortSignal
  timeout?: number
  preserveOutputOnError?: boolean
  maxBuffer?: number
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell?: boolean | string | undefined
  stdin?: 'ignore' | 'inherit' | 'pipe'
  input?: string
}

type ExecaResultWithError = {
  shortMessage?: string
  signal?: string
}

/**
 * Extracts a human-readable error message from an execa result.
 *
 * Priority order:
 * 1. shortMessage - execa's human-readable error (e.g., "Command failed with exit code 1: ...")
 *    This is preferred because it already includes signal info when a process is killed,
 *    making it more informative than just the signal name.
 * 2. signal - the signal that killed the process (e.g., "SIGTERM")
 * 3. errorCode - fallback to just the numeric exit code
 */
function getErrorMessage(
  result: ExecaResultWithError,
  errorCode: number,
): string {
  if (result.shortMessage) {
    return result.shortMessage
  }
  if (typeof result.signal === 'string') {
    return result.signal
  }
  return String(errorCode)
}

/**
 * execFile, but always resolves (never throws)
 */
export async function execFileNoThrowWithCwd(
  file: string,
  args: string[],
  {
    abortSignal,
    timeout: finalTimeout = 10 * SECONDS_IN_MINUTE * MS_IN_SECOND,
    preserveOutputOnError: finalPreserveOutput = true,
    cwd: finalCwd,
    env: finalEnv,
    maxBuffer,
    shell,
    stdin: finalStdin,
    input: finalInput,
  }: ExecFileWithCwdOptions = {
    timeout: 10 * SECONDS_IN_MINUTE * MS_IN_SECOND,
    preserveOutputOnError: true,
    maxBuffer: 1_000_000,
  },
): Promise<{ stdout: string; stderr: string; code: number; error?: string }> {
  // Fast path: use Bun.spawn directly to avoid execa overhead
  if (typeof globalThis.Bun !== 'undefined' && !shell) {
    try {
      const spawnOptions: Record<string, unknown> = {
        cwd: finalCwd,
        env: finalEnv ? { ...process.env, ...finalEnv } : undefined,
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: finalInput ? new Blob([finalInput]) : (finalStdin ?? 'ignore'),
      }

      const proc = Bun.spawn([file, ...args], spawnOptions)

      // Handle abort signal
      if (abortSignal) {
        if (abortSignal.aborted) {
          proc.kill()
          return { stdout: '', stderr: '', code: 1, error: 'aborted' }
        }
        abortSignal.addEventListener(
          'abort',
          () => {
            proc.kill()
          },
          { once: true },
        )
      }

      // Handle timeout
      let timedOut = false
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      if (finalTimeout > 0) {
        timeoutId = setTimeout(() => {
          timedOut = true
          proc.kill()
        }, finalTimeout)
      }

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

      if (timedOut) {
        const error = `timed out after ${finalTimeout}ms`
        if (finalPreserveOutput) {
          return { stdout, stderr, code: exitCode ?? 1, error }
        }
        return { stdout: '', stderr: '', code: exitCode ?? 1, error }
      }

      if (exitCode !== 0) {
        const errorCode = exitCode ?? 1
        if (finalPreserveOutput) {
          return {
            stdout: stdout || '',
            stderr: stderr || '',
            code: errorCode,
            error: String(errorCode),
          }
        }
        return { stdout: '', stderr: '', code: errorCode }
      }

      return { stdout, stderr, code: 0 }
    } catch (error) {
      logError(error)
      return { stdout: '', stderr: '', code: 1 }
    }
  }

  // Fallback to execa for non-Bun runtimes or shell mode
  return new Promise(resolve => {
    // Use execa for cross-platform .bat/.cmd compatibility on Windows
    execa(file, args, {
      maxBuffer,
      signal: abortSignal,
      timeout: finalTimeout,
      cwd: finalCwd,
      env: finalEnv,
      shell,
      stdin: finalStdin,
      input: finalInput,
      reject: false, // Don't throw on non-zero exit codes
    })
      .then(result => {
        if (result.failed) {
          if (finalPreserveOutput) {
            const errorCode = result.exitCode ?? 1
            void resolve({
              stdout: result.stdout || '',
              stderr: result.stderr || '',
              code: errorCode,
              error: getErrorMessage(
                result as unknown as ExecaResultWithError,
                errorCode,
              ),
            })
          } else {
            void resolve({ stdout: '', stderr: '', code: result.exitCode ?? 1 })
          }
        } else {
          void resolve({
            stdout: result.stdout,
            stderr: result.stderr,
            code: 0,
          })
        }
      })
      .catch((error: ExecaError) => {
        logError(error)
        void resolve({ stdout: '', stderr: '', code: 1 })
      })
  })
}
