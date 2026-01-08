import { SyncLock } from './sync-lock';

describe('SyncLock', () => {
  let syncLock: SyncLock;

  beforeEach(() => {
    syncLock = new SyncLock();
  });

  describe('acquire and release', () => {
    it('should acquire lock when not locked', async () => {
      const acquired = await syncLock.acquire();
      expect(acquired).toBe(true);
      expect(syncLock.isLocked()).toBe(true);
    });

    it('should not acquire lock when already locked', async () => {
      await syncLock.acquire();
      const secondAcquire = await syncLock.acquire();
      expect(secondAcquire).toBe(false);
    });

    it('should release lock', async () => {
      await syncLock.acquire();
      syncLock.release();
      expect(syncLock.isLocked()).toBe(false);
    });

    it('should allow acquire after release', async () => {
      await syncLock.acquire();
      syncLock.release();
      const secondAcquire = await syncLock.acquire();
      expect(secondAcquire).toBe(true);
    });
  });

  describe('withLock', () => {
    it('should execute function when lock is available', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const result = await syncLock.withLock(fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should return null when lock is not available', async () => {
      await syncLock.acquire();
      const fn = jest.fn().mockResolvedValue('result');
      const result = await syncLock.withLock(fn);
      expect(fn).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should release lock after function completes', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      await syncLock.withLock(fn);
      expect(syncLock.isLocked()).toBe(false);
    });

    it('should release lock even if function throws', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('test error'));
      await expect(syncLock.withLock(fn)).rejects.toThrow('test error');
      expect(syncLock.isLocked()).toBe(false);
    });
  });

  describe('concurrent access', () => {
    it('should only allow one execution at a time', async () => {
      const executionOrder: number[] = [];
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const task1 = syncLock.withLock(async () => {
        executionOrder.push(1);
        await delay(50);
        executionOrder.push(2);
        return 'task1';
      });

      const task2 = syncLock.withLock(async () => {
        executionOrder.push(3);
        return 'task2';
      });

      const [result1, result2] = await Promise.all([task1, task2]);

      expect(result1).toBe('task1');
      expect(result2).toBeNull(); // task2 should be skipped
      expect(executionOrder).toEqual([1, 2]); // only task1 executed
    });
  });
});
