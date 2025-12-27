import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDiaryAutoSave, UseDiaryAutoSaveProps } from './useDiaryAutoSave';
import { Location, Weather } from '../lib/diary';

jest.mock('../lib/diary', () => ({
  saveDraft: jest.fn(),
}));

import { saveDraft } from '../lib/diary';

const mockSaveDraft = saveDraft as jest.Mock;

describe('useDiaryAutoSave', () => {
  const mockLocation: Location = {
    latitude: 35.6762,
    longitude: 139.6503,
    name: 'Tokyo',
    shortName: 'Tokyo',
  };

  const mockWeather: Weather = {
    wmoCode: 1,
    description: 'Sunny',
    temperatureMin: 15,
    temperatureMax: 25,
  };

  const defaultProps = {
    initialId: null as string | null,
    title: '',
    date: new Date(2024, 0, 15),
    content: '',
    location: null as Location | null,
    weather: null as Weather | null,
    enabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSaveDraft.mockResolvedValue({
      diaryId: 'new-diary-id',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should return initial values', () => {
      const { result } = renderHook(() => useDiaryAutoSave(defaultProps));

      expect(result.current.diaryId).toBeNull();
      expect(result.current.createdAt).toBeNull();
      expect(result.current.updatedAt).toBeNull();
      expect(result.current.isSaving).toBe(false);
    });

    it('should use initialId when provided', () => {
      const { result } = renderHook(() =>
        useDiaryAutoSave({ ...defaultProps, initialId: 'existing-id' })
      );

      expect(result.current.diaryId).toBe('existing-id');
    });
  });

  describe('auto-save disabled', () => {
    it('should not save when enabled is false', async () => {
      const { rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, enabled: false } }
      );

      rerender({ ...defaultProps, enabled: false, content: 'New content' });

      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(mockSaveDraft).not.toHaveBeenCalled();
    });
  });

  describe('save draft', () => {
    it('should save draft after debounce when content changes', async () => {
      const { result, rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, enabled: true } }
      );

      rerender({ ...defaultProps, enabled: true, content: 'Hello world' });

      await act(async () => {
        jest.advanceTimersByTime(600);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith({
          diaryId: null,
          title: 'Hello world',
          date: '2024-01-15',
          content: 'Hello world',
          location: undefined,
          weather: undefined,
        });
        expect(result.current.diaryId).toBe('new-diary-id');
        expect(result.current.createdAt).toBe('2024-01-15T10:00:00Z');
        expect(result.current.updatedAt).toBe('2024-01-15T10:00:00Z');
      });
    });

    it('should use title if provided, otherwise generate from content', async () => {
      const { rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, enabled: true } }
      );

      rerender({
        ...defaultProps,
        enabled: true,
        title: 'My Title',
        content: 'Hello world',
      });

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith({
          diaryId: null,
          title: 'My Title',
          date: '2024-01-15',
          content: 'Hello world',
          location: undefined,
          weather: undefined,
        });
      });
    });

    it('should include location and weather when provided', async () => {
      const { rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, enabled: true } }
      );

      rerender({
        ...defaultProps,
        enabled: true,
        content: 'Hello',
        location: mockLocation,
        weather: mockWeather,
      });

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith({
          diaryId: null,
          title: 'Hello',
          date: '2024-01-15',
          content: 'Hello',
          location: mockLocation,
          weather: mockWeather,
        });
      });
    });
  });

  describe('update existing diary', () => {
    it('should skip first save to initialize tracking state', async () => {
      const { rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, initialId: 'existing-id', enabled: true, content: 'Loaded content' } }
      );

      // First debounce triggers save - should skip and initialize lastSaved
      await act(async () => {
        jest.advanceTimersByTime(600);
        await Promise.resolve();
      });

      // Should not have called saveDraft (just initialized tracking)
      expect(mockSaveDraft).not.toHaveBeenCalled();

      // Now make an actual change
      rerender({
        ...defaultProps,
        initialId: 'existing-id',
        enabled: true,
        content: 'Changed content',
      });

      await act(async () => {
        jest.advanceTimersByTime(600);
        await Promise.resolve();
      });

      // Now saveDraft should be called with diaryId
      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledTimes(1);
        expect(mockSaveDraft).toHaveBeenCalledWith({
          diaryId: 'existing-id',
          title: 'Changed content',
          date: '2024-01-15',
          content: 'Changed content',
          location: undefined,
          weather: undefined,
        });
      });
    });

    it('should update diary when content changes', async () => {
      const { result, rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, initialId: 'existing-id', enabled: true } }
      );

      // First trigger to initialize lastSaved
      await act(async () => {
        jest.advanceTimersByTime(600);
        await Promise.resolve();
      });

      rerender({
        ...defaultProps,
        initialId: 'existing-id',
        enabled: true,
        content: 'Updated content',
      });

      mockSaveDraft.mockResolvedValue({
        diaryId: 'existing-id',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T11:00:00Z',
      });

      await act(async () => {
        jest.advanceTimersByTime(600);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith({
          diaryId: 'existing-id',
          title: 'Updated content',
          date: '2024-01-15',
          content: 'Updated content',
          location: undefined,
          weather: undefined,
        });
        expect(result.current.diaryId).toBe('existing-id');
        expect(result.current.updatedAt).toBe('2024-01-15T11:00:00Z');
      });
    });
  });

  describe('debouncing', () => {
    it('should debounce multiple rapid changes', async () => {
      const { rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, enabled: true } }
      );

      rerender({ ...defaultProps, enabled: true, content: 'First' });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      rerender({ ...defaultProps, enabled: true, content: 'Second' });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      rerender({ ...defaultProps, enabled: true, content: 'Third' });
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledTimes(1);
        expect(mockSaveDraft).toHaveBeenCalledWith({
          diaryId: null,
          title: 'Third',
          date: '2024-01-15',
          content: 'Third',
          location: undefined,
          weather: undefined,
        });
      });
    });
  });

  describe('skip save when no changes', () => {
    it('should not save again if nothing changed', async () => {
      const { rerender } = renderHook(
        (props: UseDiaryAutoSaveProps) => useDiaryAutoSave(props),
        { initialProps: { ...defaultProps, enabled: true, content: 'Hello' } }
      );

      // First save
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledTimes(1);
      });

      // Trigger again with same content
      rerender({ ...defaultProps, enabled: true, content: 'Hello' });
      act(() => {
        jest.advanceTimersByTime(600);
      });

      // Should still be 1 call
      expect(mockSaveDraft).toHaveBeenCalledTimes(1);
    });
  });

  describe('setters', () => {
    it('should allow setting createdAt externally', () => {
      const { result } = renderHook(() => useDiaryAutoSave(defaultProps));

      act(() => {
        result.current.setCreatedAt('2024-01-01T00:00:00Z');
      });

      expect(result.current.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should allow setting updatedAt externally', () => {
      const { result } = renderHook(() => useDiaryAutoSave(defaultProps));

      act(() => {
        result.current.setUpdatedAt('2024-01-01T00:00:00Z');
      });

      expect(result.current.updatedAt).toBe('2024-01-01T00:00:00Z');
    });
  });
});
