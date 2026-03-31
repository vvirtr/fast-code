/**
 * Native JavaScript replacements for lodash-es functions.
 * Each function matches the lodash-es API surface used in this codebase.
 */

// ---------------------------------------------------------------------------
// memoize
// ---------------------------------------------------------------------------
// Matches lodash memoize: single-arg by default, supports resolver,
// exposes `.cache` as a Map with .clear(), .has(), .get(), .set(), .delete().

export interface MemoizedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>
  cache: Map<any, ReturnType<T>>
}

export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  resolver?: (...args: Parameters<T>) => any,
): MemoizedFunction<T> {
  const cache = new Map<any, ReturnType<T>>()
  const memoized = function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = resolver ? resolver(...args) : args[0]
    if (cache.has(key)) {
      return cache.get(key)!
    }
    const result = fn.apply(this, args)
    cache.set(key, result)
    return result
  } as MemoizedFunction<T>
  memoized.cache = cache
  return memoized
}

// ---------------------------------------------------------------------------
// uniqBy
// ---------------------------------------------------------------------------
export function uniqBy<T>(array: T[], iteratee: ((item: T) => any) | string): T[] {
  const seen = new Set<any>()
  const result: T[] = []
  const getKey =
    typeof iteratee === 'function'
      ? iteratee
      : (item: T) => (item as any)[iteratee]
  for (const item of array) {
    const key = getKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// sample
// ---------------------------------------------------------------------------
export function sample<T>(array: T[]): T | undefined {
  if (!array || array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
}

// ---------------------------------------------------------------------------
// capitalize
// ---------------------------------------------------------------------------
export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// ---------------------------------------------------------------------------
// isEqual  –  delegates to Node's built-in deep strict equality
// ---------------------------------------------------------------------------
import { isDeepStrictEqual } from 'node:util'
export function isEqual(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(a, b)
}

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------
export function omit<T extends Record<string, any>>(
  obj: T,
  ...keys: (string | string[])[]
): Partial<T> {
  const keysToOmit = new Set(keys.flat())
  const result = {} as any
  for (const key of Object.keys(obj)) {
    if (!keysToOmit.has(key)) {
      result[key] = obj[key]
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// reject  –  inverse of Array.filter
// ---------------------------------------------------------------------------
export function reject<T>(
  array: T[],
  predicate: (item: T, index: number) => boolean,
): T[] {
  return array.filter((item, index) => !predicate(item, index))
}

// ---------------------------------------------------------------------------
// pickBy
// ---------------------------------------------------------------------------
export function pickBy<T extends Record<string, any>>(
  obj: T,
  predicate: (value: any, key: string) => boolean,
): Partial<T> {
  const result = {} as any
  for (const [key, value] of Object.entries(obj)) {
    if (predicate(value, key)) {
      result[key] = value
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// mapValues
// ---------------------------------------------------------------------------
export function mapValues<T extends Record<string, any>, R>(
  obj: T,
  iteratee: (value: T[keyof T], key: string) => R,
): Record<string, R> {
  const result = {} as Record<string, R>
  for (const [key, value] of Object.entries(obj)) {
    result[key] = iteratee(value, key)
  }
  return result
}

// ---------------------------------------------------------------------------
// partition
// ---------------------------------------------------------------------------
export function partition<T>(
  array: T[],
  predicate: (item: T) => boolean,
): [T[], T[]] {
  const pass: T[] = []
  const fail: T[] = []
  for (const item of array) {
    if (predicate(item)) {
      pass.push(item)
    } else {
      fail.push(item)
    }
  }
  return [pass, fail]
}

// ---------------------------------------------------------------------------
// sumBy  –  supports both function and string iteratee (lodash style)
// ---------------------------------------------------------------------------
export function sumBy<T>(
  array: T[],
  iteratee: ((item: T) => number) | string,
): number {
  const getVal =
    typeof iteratee === 'function'
      ? iteratee
      : (item: T) => (item as any)[iteratee] as number
  let sum = 0
  for (const item of array) {
    sum += getVal(item) || 0
  }
  return sum
}

// ---------------------------------------------------------------------------
// zipObject
// ---------------------------------------------------------------------------
export function zipObject<V>(keys: string[], values: V[]): Record<string, V> {
  const result = {} as Record<string, V>
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]!] = values[i]!
  }
  return result
}

// ---------------------------------------------------------------------------
// isPlainObject
// ---------------------------------------------------------------------------
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

// ---------------------------------------------------------------------------
// throttle  –  supports { leading, trailing } options and .cancel()
// ---------------------------------------------------------------------------
export interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined
  cancel: () => void
  flush: () => ReturnType<T> | undefined
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean },
): ThrottledFunction<T> {
  const leading = options?.leading !== false
  const trailing = options?.trailing !== false
  let lastCallTime: number | undefined
  let lastInvokeTime = 0
  let timerId: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastThis: any
  let result: ReturnType<T> | undefined

  function invoke(time: number): ReturnType<T> {
    lastInvokeTime = time
    const args = lastArgs!
    const thisArg = lastThis
    lastArgs = undefined
    lastThis = undefined
    result = fn.apply(thisArg, args)
    return result!
  }

  function startTimer(pendingFn: () => void, delay: number): void {
    timerId = setTimeout(pendingFn, delay)
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - (lastCallTime ?? 0)
    return Math.max(0, wait - timeSinceLastCall)
  }

  function shouldInvoke(time: number): boolean {
    if (lastCallTime === undefined) return true
    const timeSinceLastCall = time - lastCallTime
    return timeSinceLastCall >= wait || timeSinceLastCall < 0
  }

  function trailingEdge(): void {
    timerId = undefined
    if (trailing && lastArgs) {
      invoke(Date.now())
    } else {
      lastArgs = undefined
      lastThis = undefined
    }
  }

  function timerExpired(): void {
    const time = Date.now()
    if (shouldInvoke(time)) {
      trailingEdge()
      return
    }
    startTimer(timerExpired, remainingWait(time))
  }

  function leadingEdge(time: number): ReturnType<T> | undefined {
    lastInvokeTime = time
    startTimer(timerExpired, wait)
    return leading ? invoke(time) : result
  }

  const throttled = function (this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)
    lastArgs = args
    lastThis = this
    lastCallTime = time

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(time)
      }
      // Handle trailing edge in a throttle scenario
    }
    if (timerId === undefined) {
      startTimer(timerExpired, wait)
    }
    return result
  } as ThrottledFunction<T>

  throttled.cancel = (): void => {
    if (timerId !== undefined) {
      clearTimeout(timerId)
    }
    lastInvokeTime = 0
    lastArgs = undefined
    lastThis = undefined
    lastCallTime = undefined
    timerId = undefined
  }

  throttled.flush = (): ReturnType<T> | undefined => {
    if (timerId !== undefined) {
      trailingEdge()
      if (timerId !== undefined) {
        clearTimeout(timerId)
        timerId = undefined
      }
    }
    return result
  }

  return throttled
}

// ---------------------------------------------------------------------------
// cloneDeep  –  delegates to structuredClone
// ---------------------------------------------------------------------------
export function cloneDeep<T>(value: T): T {
  return structuredClone(value)
}

// ---------------------------------------------------------------------------
// mergeWith  –  recursive merge with customizer
// ---------------------------------------------------------------------------
export function mergeWith<T extends Record<string, any>>(
  target: T,
  source: Record<string, any>,
  customizer: (objValue: any, srcValue: any, key: string, object: any, source: any) => any,
): T {
  if (source == null) return target
  for (const key of Object.keys(source)) {
    const srcValue = source[key]
    const objValue = (target as any)[key]
    const customResult = customizer(objValue, srcValue, key, target, source)
    if (customResult !== undefined) {
      ;(target as any)[key] = customResult
    } else if (
      srcValue != null &&
      typeof srcValue === 'object' &&
      !Array.isArray(srcValue) &&
      objValue != null &&
      typeof objValue === 'object' &&
      !Array.isArray(objValue)
    ) {
      mergeWith(objValue, srcValue, customizer)
    } else {
      ;(target as any)[key] = srcValue
    }
  }
  return target
}

// ---------------------------------------------------------------------------
// setWith  –  deep set using dot-path with customizer for intermediates
// ---------------------------------------------------------------------------
export function setWith<T extends Record<string, any>>(
  object: T,
  path: string | string[],
  value: any,
  customizer?: (nsValue: any, key: string, nsObject: any) => any,
): T {
  const parts = Array.isArray(path) ? path : path.split('.')
  let current: any = object
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!
    let next = current[key]
    if (next == null || typeof next !== 'object') {
      next = customizer ? customizer(current[key], key, current) ?? {} : {}
      current[key] = next
    }
    current = next
  }
  current[parts[parts.length - 1]!] = value
  return object
}
