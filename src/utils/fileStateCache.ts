import { LRUCache } from 'lru-cache'
import { normalize } from 'path'

export type FileState = {
  content: string
  timestamp: number
  offset: number | undefined
  limit: number | undefined
  // True when this entry was populated by auto-injection (e.g. CLAUDE.md) and
  // the injected content did not match disk (stripped HTML comments, stripped
  // frontmatter, truncated MEMORY.md). The model has only seen a partial view;
  // Edit/Write must require an explicit Read first. `content` here holds the
  // RAW disk bytes (for getChangedFiles diffing), not what the model saw.
  isPartialView?: boolean
}

// Default max entries for read file state caches
export const READ_FILE_STATE_CACHE_SIZE = 200

// Default size limit for file state caches (25MB)
// This prevents unbounded memory growth from large file contents
const DEFAULT_MAX_CACHE_SIZE_BYTES = 25 * 1024 * 1024

/**
 * A file state cache that normalizes all path keys before access.
 * This ensures consistent cache hits regardless of whether callers pass
 * relative vs absolute paths with redundant segments (e.g. /foo/../bar)
 * or mixed path separators on Windows (/ vs \).
 */
export class FileStateCache {
  private cache: LRUCache<string, FileState>

  constructor(maxEntries: number, maxSizeBytes: number) {
    this.cache = new LRUCache<string, FileState>({
      max: maxEntries,
      maxSize: maxSizeBytes,
      sizeCalculation: value => Math.max(1, Buffer.byteLength(value.content)),
    })
  }

  get(key: string): FileState | undefined {
    return this.cache.get(normalize(key))
  }

  set(key: string, value: FileState): this {
    this.cache.set(normalize(key), value)
    return this
  }

  has(key: string): boolean {
    return this.cache.has(normalize(key))
  }

  delete(key: string): boolean {
    return this.cache.delete(normalize(key))
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  get max(): number {
    return this.cache.max
  }

  get maxSize(): number {
    return this.cache.maxSize
  }

  get calculatedSize(): number {
    return this.cache.calculatedSize
  }

  keys(): Generator<string> {
    return this.cache.keys()
  }

  entries(): Generator<[string, FileState]> {
    return this.cache.entries()
  }

  dump(): ReturnType<LRUCache<string, FileState>['dump']> {
    return this.cache.dump()
  }

  load(entries: ReturnType<LRUCache<string, FileState>['dump']>): void {
    this.cache.load(entries)
  }
}

/**
 * Factory function to create a size-limited FileStateCache.
 * Uses LRUCache's built-in size-based eviction to prevent memory bloat.
 * Note: Images are not cached (see FileReadTool) so size limit is mainly
 * for large text files, notebooks, and other editable content.
 */
export function createFileStateCacheWithSizeLimit(
  maxEntries: number,
  maxSizeBytes: number = DEFAULT_MAX_CACHE_SIZE_BYTES,
): FileStateCache {
  return new FileStateCache(maxEntries, maxSizeBytes)
}

// Helper function to convert cache to object (used by compact.ts)
export function cacheToObject(
  cache: FileStateCache,
): Record<string, FileState> {
  return Object.fromEntries(cache.entries())
}

// Helper function to get all keys from cache (used by several components)
export function cacheKeys(cache: FileStateCache): string[] {
  return Array.from(cache.keys())
}

// Helper function to clone a FileStateCache
// Preserves size limit configuration from the source cache
export function cloneFileStateCache(cache: FileStateCache): FileStateCache {
  const cloned = createFileStateCacheWithSizeLimit(cache.max, cache.maxSize)
  cloned.load(cache.dump())
  return cloned
}

/**
 * Copy-on-write wrapper around a parent FileStateCache.
 *
 * Reads fall through to the (shared, read-only) parent cache; writes land in a
 * lightweight overlay Map.  This avoids deep-copying up to 25 MB of cached file
 * content when forking an agent — the parent data is shared in O(1) and the
 * child only pays for the entries it actually mutates.
 *
 * The `keys()` / `entries()` / `size` / `dump()` / `load()` accessors are
 * implemented for correctness but are not on the hot path for subagent usage
 * (only `get`, `set`, `has`, `delete`, `clear` are called via readFileState).
 */
export class COWFileStateCache extends FileStateCache {
  private overlay = new Map<string, FileState>()
  private deletedKeys = new Set<string>()

  constructor(private parent: FileStateCache) {
    // The super constructor creates an empty LRU — negligible cost.
    // We never touch it; all methods are overridden to use the overlay.
    super(1, 1)
  }

  override get(key: string): FileState | undefined {
    const k = normalize(key)
    if (this.deletedKeys.has(k)) return undefined
    return this.overlay.get(k) ?? this.parent.get(k)
  }

  override set(key: string, value: FileState): this {
    const k = normalize(key)
    this.deletedKeys.delete(k)
    this.overlay.set(k, value)
    return this
  }

  override has(key: string): boolean {
    const k = normalize(key)
    if (this.deletedKeys.has(k)) return false
    return this.overlay.has(k) || this.parent.has(k)
  }

  override delete(key: string): boolean {
    const k = normalize(key)
    const existed = this.has(key)
    this.overlay.delete(k)
    this.deletedKeys.add(k)
    return existed
  }

  override clear(): void {
    this.overlay.clear()
    this.deletedKeys.clear()
    // Don't clear parent — it's shared with other consumers
  }

  override get size(): number {
    let count = this.overlay.size
    for (const key of this.parent.keys()) {
      if (!this.overlay.has(key) && !this.deletedKeys.has(key)) {
        count++
      }
    }
    return count
  }

  override get max(): number {
    return this.parent.max
  }

  override get maxSize(): number {
    return this.parent.maxSize
  }

  override get calculatedSize(): number {
    // Approximation: overlay size + parent's size for non-overridden entries
    let bytes = 0
    for (const value of this.overlay.values()) {
      bytes += Math.max(1, Buffer.byteLength(value.content))
    }
    // Parent calculatedSize is an approximation; the COW child doesn't evict
    // from the parent so we just report the overlay's own size.
    return bytes
  }

  override *keys(): Generator<string> {
    // Yield overlay keys first
    for (const key of this.overlay.keys()) {
      yield key
    }
    // Then parent keys that aren't overridden or deleted
    for (const key of this.parent.keys()) {
      if (!this.overlay.has(key) && !this.deletedKeys.has(key)) {
        yield key
      }
    }
  }

  override *entries(): Generator<[string, FileState]> {
    for (const entry of this.overlay.entries()) {
      yield entry
    }
    for (const [key, value] of this.parent.entries()) {
      if (!this.overlay.has(key) && !this.deletedKeys.has(key)) {
        yield [key, value]
      }
    }
  }

  override dump(): ReturnType<LRUCache<string, FileState>['dump']> {
    // Materialize into a dump-compatible format for interop with cloneFileStateCache
    const temp = new LRUCache<string, FileState>({
      max: this.parent.max,
      maxSize: this.parent.maxSize,
      sizeCalculation: value => Math.max(1, Buffer.byteLength(value.content)),
    })
    // Load parent entries first, then overlay on top
    for (const [key, value] of this.parent.entries()) {
      if (!this.deletedKeys.has(key)) {
        temp.set(key, value)
      }
    }
    for (const [key, value] of this.overlay.entries()) {
      temp.set(key, value)
    }
    return temp.dump()
  }

  override load(
    entries: ReturnType<LRUCache<string, FileState>['dump']>,
  ): void {
    // Load into overlay — don't touch parent
    for (const entry of entries) {
      if (entry[1] !== undefined) {
        this.overlay.set(entry[0], entry[1])
      }
    }
  }
}

/**
 * Create a copy-on-write file state cache backed by an existing parent cache.
 * Reads fall through to the parent; writes go to a local overlay.
 * This is O(1) to create vs O(n) for cloneFileStateCache.
 */
export function createCOWFileStateCache(
  parent: FileStateCache,
): FileStateCache {
  return new COWFileStateCache(parent)
}

// Merge two file state caches, with more recent entries (by timestamp) overriding older ones
export function mergeFileStateCaches(
  first: FileStateCache,
  second: FileStateCache,
): FileStateCache {
  const merged = cloneFileStateCache(first)
  for (const [filePath, fileState] of second.entries()) {
    const existing = merged.get(filePath)
    // Only override if the new entry is more recent
    if (!existing || fileState.timestamp > existing.timestamp) {
      merged.set(filePath, fileState)
    }
  }
  return merged
}
