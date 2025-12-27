import { useEffect, useState, useCallback } from 'react';
import { Location, Weather } from '../lib/diary';
import { getWeather } from '../lib/weather';
import { isWeatherEnabled } from '../lib/secrets';

const COOLDOWN_MS = 10000;

interface UseWeatherFetchResult {
  weather: Weather | null;
  isLoading: boolean;
  canRefresh: boolean;
  refresh: () => Promise<void>;
  setWeather: (weather: Weather | null) => void;
}

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function useWeatherFetch(
  location: Location | null,
  date: Date
): UseWeatherFetchResult {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  // Load weather enabled setting
  useEffect(() => {
    isWeatherEnabled().then(setEnabled);
  }, []);

  const canRefresh = enabled && !isLoading && !cooldown && location !== null;

  const refresh = useCallback(async () => {
    if (!location) {
      setWeather(null);
      return;
    }

    setIsLoading(true);
    try {
      const dateStr = formatDate(date);
      const result = await getWeather(location.latitude, location.longitude, dateStr);
      setWeather(result);
    } finally {
      setIsLoading(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), COOLDOWN_MS);
    }
  }, [location, date]);

  return {
    weather,
    isLoading,
    canRefresh,
    refresh,
    setWeather,
  };
}
