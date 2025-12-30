import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWeatherFetch } from './useWeatherFetch';
import { Location, Weather } from '../lib/entry';

// Mock dependencies
jest.mock('../lib/weather', () => ({
  getWeather: jest.fn(),
}));

jest.mock('../lib/secrets', () => ({
  isWeatherEnabled: jest.fn(),
}));

import { getWeather } from '../lib/weather';
import { isWeatherEnabled } from '../lib/secrets';

const mockGetWeather = getWeather as jest.Mock;
const mockIsWeatherEnabled = isWeatherEnabled as jest.Mock;

describe('useWeatherFetch', () => {
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

  const mockDate = new Date(2024, 0, 15);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsWeatherEnabled.mockResolvedValue(true);
    mockGetWeather.mockResolvedValue(mockWeather);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should return null weather initially', () => {
      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      expect(result.current.weather).toBeNull();
    });

    it('should not be loading initially', () => {
      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      expect(result.current.isLoading).toBe(false);
    });

    it('should load weather enabled setting on mount', async () => {
      renderHook(() => useWeatherFetch(mockLocation, mockDate));

      await waitFor(() => {
        expect(mockIsWeatherEnabled).toHaveBeenCalled();
      });
    });
  });

  describe('refresh', () => {
    it('should fetch weather when refresh is called', async () => {
      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      await waitFor(() => {
        expect(result.current.canRefresh).toBe(true);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockGetWeather).toHaveBeenCalledWith(
        mockLocation.latitude,
        mockLocation.longitude,
        '2024-01-15'
      );
      expect(result.current.weather).toEqual(mockWeather);
    });

    it('should set isLoading during fetch', async () => {
      let resolveWeather: (value: Weather) => void;
      mockGetWeather.mockReturnValue(
        new Promise((resolve) => {
          resolveWeather = resolve;
        })
      );

      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      await waitFor(() => {
        expect(result.current.canRefresh).toBe(true);
      });

      act(() => {
        result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveWeather!(mockWeather);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('canRefresh', () => {
    it('should be false when weather is disabled', async () => {
      mockIsWeatherEnabled.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      await waitFor(() => {
        expect(result.current.canRefresh).toBe(false);
      });
    });

    it('should be false when location is null', async () => {
      const { result } = renderHook(() =>
        useWeatherFetch(null, mockDate)
      );

      await waitFor(() => {
        expect(mockIsWeatherEnabled).toHaveBeenCalled();
      });

      expect(result.current.canRefresh).toBe(false);
    });

    it('should be false during cooldown', async () => {
      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      await waitFor(() => {
        expect(result.current.canRefresh).toBe(true);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.canRefresh).toBe(false);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.canRefresh).toBe(true);
    });

    it('should be false while loading', async () => {
      let resolveWeather: (value: Weather) => void;
      mockGetWeather.mockReturnValue(
        new Promise((resolve) => {
          resolveWeather = resolve;
        })
      );

      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      await waitFor(() => {
        expect(result.current.canRefresh).toBe(true);
      });

      act(() => {
        result.current.refresh();
      });

      expect(result.current.canRefresh).toBe(false);

      await act(async () => {
        resolveWeather!(mockWeather);
      });
    });
  });

  describe('setWeather', () => {
    it('should allow setting weather externally', async () => {
      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      act(() => {
        result.current.setWeather(mockWeather);
      });

      expect(result.current.weather).toEqual(mockWeather);
    });

    it('should allow setting weather to null', async () => {
      const { result } = renderHook(() =>
        useWeatherFetch(mockLocation, mockDate)
      );

      act(() => {
        result.current.setWeather(mockWeather);
      });
      expect(result.current.weather).toEqual(mockWeather);

      act(() => {
        result.current.setWeather(null);
      });
      expect(result.current.weather).toBeNull();
    });
  });
});
