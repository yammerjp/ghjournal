import { renderHook, act } from '@testing-library/react-native';
import { useKeyboardHeight } from './useKeyboardHeight';

// Mock Keyboard listeners storage
const mockListeners: Record<string, ((e: any) => void)[]> = {};

jest.mock('react-native', () => ({
  Keyboard: {
    addListener: jest.fn((event: string, callback: (e: any) => void) => {
      if (!mockListeners[event]) {
        mockListeners[event] = [];
      }
      mockListeners[event].push(callback);
      const removeFn = jest.fn(() => {
        const index = mockListeners[event].indexOf(callback);
        if (index !== -1) {
          mockListeners[event].splice(index, 1);
        }
      });
      return { remove: removeFn };
    }),
  },
}));

import { Keyboard } from 'react-native';

const emitKeyboardEvent = (event: string, data: any) => {
  mockListeners[event]?.forEach((cb) => cb(data));
};

describe('useKeyboardHeight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockListeners).forEach((key) => delete mockListeners[key]);
  });

  it('should return 0 initially', () => {
    const { result } = renderHook(() => useKeyboardHeight());
    expect(result.current).toBe(0);
  });

  it('should update height when keyboard shows', () => {
    const { result } = renderHook(() => useKeyboardHeight());

    act(() => {
      emitKeyboardEvent('keyboardWillShow', {
        endCoordinates: { height: 300 },
      });
    });

    expect(result.current).toBe(300);
  });

  it('should reset height when keyboard hides', () => {
    const { result } = renderHook(() => useKeyboardHeight());

    act(() => {
      emitKeyboardEvent('keyboardWillShow', {
        endCoordinates: { height: 300 },
      });
    });
    expect(result.current).toBe(300);

    act(() => {
      emitKeyboardEvent('keyboardWillHide', {});
    });
    expect(result.current).toBe(0);
  });

  it('should clean up listeners on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardHeight());

    expect(Keyboard.addListener).toHaveBeenCalledTimes(2);
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardWillShow', expect.any(Function));
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardWillHide', expect.any(Function));

    unmount();

    expect(mockListeners['keyboardWillShow']?.length ?? 0).toBe(0);
    expect(mockListeners['keyboardWillHide']?.length ?? 0).toBe(0);
  });
});
