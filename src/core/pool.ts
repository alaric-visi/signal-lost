/* Fixed-identity object pool. Live items occupy items[0..count); killing one
   swaps it with the last live item, so nothing is allocated or spliced during
   play. Iterate backwards when killing inside the loop. Order is not kept. */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;
  private readonly make: () => T;

  constructor(make: () => T) {
    this.make = make;
  }

  /* Returns a recycled object: the caller must set every field. */
  spawn(): T {
    if (this.count === this.items.length) this.items.push(this.make());
    return this.items[this.count++];
  }

  kill(i: number): void {
    const last = --this.count;
    if (i !== last) {
      const t = this.items[i];
      this.items[i] = this.items[last];
      this.items[last] = t;
    }
  }

  clear(): void {
    this.count = 0;
  }
}
