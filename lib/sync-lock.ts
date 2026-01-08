/**
 * A simple mutex lock for synchronization operations.
 * Ensures only one sync operation runs at a time.
 */
export class SyncLock {
  private locked = false;

  /**
   * Try to acquire the lock.
   * @returns true if lock was acquired, false if already locked
   */
  async acquire(): Promise<boolean> {
    if (this.locked) {
      return false;
    }
    this.locked = true;
    return true;
  }

  /**
   * Release the lock.
   */
  release(): void {
    this.locked = false;
  }

  /**
   * Check if the lock is currently held.
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Execute a function with the lock.
   * If lock is not available, returns null without executing.
   * @param fn The async function to execute
   * @returns The result of fn, or null if lock was not available
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T | null> {
    const acquired = await this.acquire();
    if (!acquired) {
      return null;
    }
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
