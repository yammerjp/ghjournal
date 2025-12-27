import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDiaryAutoSave, UseDiaryAutoSaveProps } from './useDiaryAutoSave';
import { Location, Weather } from '../lib/diary';

jest.mock('../lib/diary', () => ({
  createDiary: jest.fn(),
  updateDiary: jest.fn(),
}));

import { createDiary, updateDiary } from '../lib/diary';

const mockCreateDiary = createDiary as jest.Mock;
const mockUpdateDiary = updateDiary as jest.Mock;

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
    mockCreateDiary.mockResolvedValue({ id: 'new-diary-id' });
    mockUpdateDiary.mockResolvedValue(true);
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

      expect(mockCreateDiary).not.toHaveBeenCalled();
      expect(mockUpdateDiary).not.toHaveBeenCalled();
    });
  });

  describe('create new diary', () => {
    it('should create diary after debounce when content changes', async () => {
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
        expect(mockCreateDiary).toHaveBeenCalledWith(
          'Hello world',
          '2024-01-15',
          'Hello world',
          undefined,
          undefined
        );
        expect(result.current.diaryId).toBe('new-diary-id');
        expect(result.current.createdAt).not.toBeNull();
        expect(result.current.updatedAt).not.toBeNull();
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
        expect(mockCreateDiary).toHaveBeenCalledWith(
          'My Title',
          '2024-01-15',
          'Hello world',
          undefined,
          undefined
        );
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
        expect(mockCreateDiary).toHaveBeenCalledWith(
          'Hello',
          '2024-01-15',
          'Hello',
          mockLocation,
          mockWeather
        );
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

      // Should not have called update (just initialized tracking)
      expect(mockUpdateDiary).not.toHaveBeenCalled();

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

      // Now update should be called
      await waitFor(() => {
        expect(mockUpdateDiary).toHaveBeenCalledTimes(1);
        expect(mockUpdateDiary).toHaveBeenCalledWith(
          'existing-id',
          'Changed content',
          '2024-01-15',
          'Changed content',
          null,
          null
        );
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

      await act(async () => {
        jest.advanceTimersByTime(600);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockUpdateDiary).toHaveBeenCalledWith(
          'existing-id',
          'Updated content',
          '2024-01-15',
          'Updated content',
          null,
          null
        );
        expect(result.current.diaryId).toBe('existing-id');
        expect(result.current.updatedAt).not.toBeNull();
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
        expect(mockCreateDiary).toHaveBeenCalledTimes(1);
        expect(mockCreateDiary).toHaveBeenCalledWith(
          'Third',
          '2024-01-15',
          'Third',
          undefined,
          undefined
        );
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
        expect(mockCreateDiary).toHaveBeenCalledTimes(1);
      });

      // Trigger again with same content
      rerender({ ...defaultProps, enabled: true, content: 'Hello' });
      act(() => {
        jest.advanceTimersByTime(600);
      });

      // Should still be 1 call
      expect(mockCreateDiary).toHaveBeenCalledTimes(1);
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
