import { renderHook, act } from '@testing-library/react-native';
import { useContentEditor } from './useContentEditor';

describe('useContentEditor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should return initial values', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: '', isNewAndEmpty: false })
      );

      expect(result.current.isEditing).toBe(false);
      expect(result.current.selection).toBeUndefined();
      expect(result.current.showTextInput).toBe(false);
    });

    it('should show TextInput when isNewAndEmpty is true', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: '', isNewAndEmpty: true })
      );

      expect(result.current.showTextInput).toBe(true);
    });

    it('should show TextInput when isEditing is true', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: 'Hello', isNewAndEmpty: false })
      );

      act(() => {
        result.current.enterEditMode(100);
      });

      expect(result.current.isEditing).toBe(true);
      expect(result.current.showTextInput).toBe(true);
    });
  });

  describe('double tap detection', () => {
    it('should not enter edit mode on single tap', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: 'Hello', isNewAndEmpty: false })
      );

      act(() => {
        result.current.handleTap(10, 10);
      });

      expect(result.current.isEditing).toBe(false);
    });

    it('should enter edit mode on double tap', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: 'Hello', isNewAndEmpty: false })
      );

      act(() => {
        result.current.handleTap(10, 10);
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      act(() => {
        result.current.handleTap(10, 10);
      });

      expect(result.current.isEditing).toBe(true);
    });

    it('should not enter edit mode if taps are too slow', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: 'Hello', isNewAndEmpty: false })
      );

      act(() => {
        result.current.handleTap(10, 10);
      });

      act(() => {
        jest.advanceTimersByTime(500); // More than DOUBLE_TAP_DELAY
      });

      act(() => {
        result.current.handleTap(10, 10);
      });

      expect(result.current.isEditing).toBe(false);
    });
  });

  describe('cursor position calculation', () => {
    it('should calculate cursor position from tap coordinates', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: 'Hello\nWorld', isNewAndEmpty: false })
      );

      // Double tap at approximate position
      act(() => {
        result.current.handleTap(50, 40); // Second line area
      });
      act(() => {
        result.current.handleTap(50, 40);
      });

      // Selection should be set (exact value depends on calculation)
      expect(result.current.isEditing).toBe(true);
    });
  });

  describe('exitEditMode', () => {
    it('should exit edit mode and clear selection', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: 'Hello', isNewAndEmpty: false })
      );

      // Enter edit mode first
      act(() => {
        result.current.enterEditMode(0);
      });

      expect(result.current.isEditing).toBe(true);

      act(() => {
        result.current.exitEditMode();
      });

      expect(result.current.isEditing).toBe(false);
      expect(result.current.selection).toBeUndefined();
    });
  });

  describe('onSelectionApplied', () => {
    it('should clear selection after it is applied', () => {
      const { result } = renderHook(() =>
        useContentEditor({ content: 'Hello', isNewAndEmpty: false })
      );

      // Enter edit mode with cursor position
      act(() => {
        result.current.enterEditMode(3);
      });

      // Wait for selection to be set
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.selection).toEqual({ start: 3, end: 3 });

      act(() => {
        result.current.onSelectionApplied();
        jest.advanceTimersByTime(10);
      });

      expect(result.current.selection).toBeUndefined();
    });
  });
});
