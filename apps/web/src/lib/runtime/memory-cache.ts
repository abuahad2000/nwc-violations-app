type Entry = { expiresAt: number; value: unknown };
const entries = new Map<string, Entry>();

export async function withMemoryCache<T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = entries.get(key);
  if (cached && cached.expiresAt > now) return cached.value as T;
  const value = await producer();
  entries.set(key, { value, expiresAt: now + ttlMs });
  if (entries.size > 500) {
    for (const [entryKey, entry] of entries) if (entry.expiresAt <= now) entries.delete(entryKey);
  }
  return value;
}
