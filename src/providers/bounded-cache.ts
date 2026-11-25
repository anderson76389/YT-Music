/** Small memory-only LRU. Weight is an estimate supplied by the caller. */
export class BoundedCache<K, V> {
  private entries = new Map<K, { value: V; weight: number }>();
  private weight = 0;
  constructor(private readonly maxEntries: number, private readonly maxWeight: number) {}

  get size(): number { return this.entries.size; }
  get totalWeight(): number { return this.weight; }

  get(key: K): V | undefined {
    const item = this.entries.get(key);
    if (!item) return undefined;
    this.entries.delete(key);
    this.entries.set(key, item);
    return item.value;
  }

  set(key: K, value: V, weight: number): void {
    const previous = this.entries.get(key);
    if (previous) {
      this.weight -= previous.weight;
      this.entries.delete(key);
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > this.maxWeight || this.maxEntries < 1) return;
    this.entries.set(key, { value, weight });
    this.weight += weight;
    while (this.entries.size > this.maxEntries || this.weight > this.maxWeight) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      const item = this.entries.get(oldest.value);
      if (item) this.weight -= item.weight;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
    this.weight = 0;
  }
}
