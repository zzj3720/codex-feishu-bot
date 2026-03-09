export class AsyncEventQueue<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) {
      return;
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({
        done: false,
        value
      });
      return;
    }

    this.values.push(value);
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    for (const waiter of this.waiters) {
      waiter({
        done: true,
        value: undefined
      });
    }
    this.waiters.length = 0;
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.values.length > 0) {
      const value = this.values.shift() as T;
      return {
        done: false,
        value
      };
    }

    if (this.closed) {
      return {
        done: true,
        value: undefined
      };
    }

    return new Promise<IteratorResult<T>>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  async *iterate(): AsyncGenerator<T> {
    while (true) {
      const result = await this.next();
      if (result.done) {
        return;
      }

      yield result.value;
    }
  }
}
