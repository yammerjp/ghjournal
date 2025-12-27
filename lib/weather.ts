import { isWeatherEnabled } from './secrets';
import { debugLog } from './debug-log';
import { Weather } from './diary';

// Open-Meteo API response
interface OpenMeteoResponse {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

// WMO Weather interpretation codes
const weatherCodeToDescription: Record<number, string> = {
  0: '快晴',
  1: '晴れ',
  2: 'くもり時々晴れ',
  3: 'くもり',
  45: '霧',
  48: '霧氷',
  51: '小雨',
  53: '雨',
  55: '強い雨',
  56: '弱い着氷性の雨',
  57: '着氷性の雨',
  61: '小雨',
  63: '雨',
  65: '強い雨',
  66: '弱い着氷性の雨',
  67: '着氷性の雨',
  71: '小雪',
  73: '雪',
  75: '大雪',
  77: '霧雪',
  80: '小雨',
  81: 'にわか雨',
  82: '強いにわか雨',
  85: '小雪',
  86: 'にわか雪',
  95: '雷雨',
  96: '雷雨(ひょう)',
  99: '激しい雷雨(ひょう)',
};

export function getWeatherDescription(wmoCode: number): string {
  return weatherCodeToDescription[wmoCode] ?? `天気コード${wmoCode}`;
}

export async function getWeather(
  latitude: number,
  longitude: number,
  date: string
): Promise<Weather | null> {
  // Check if weather feature is enabled
  const enabled = await isWeatherEnabled();
  if (!enabled) {
    await debugLog.info('Weather fetch skipped: feature disabled');
    return null;
  }

  try {
    await debugLog.info(`Weather fetch started`, `lat=${latitude}, lon=${longitude}, date=${date}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    let url: string;
    if (diffDays >= 2) {
      // 2+ days in the past: use Historical API
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Tokyo`;
    } else if (diffDays >= -16) {
      // Today, yesterday, or up to 16 days in future: use Forecast API
      url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Tokyo`;
    } else {
      // Too far in the future
      await debugLog.info('Weather fetch skipped: date too far in future', `diffDays=${diffDays}`);
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      await debugLog.error(`Weather API error: ${response.status}`, errorText);
      return null;
    }

    const data: OpenMeteoResponse = await response.json();

    if (data.daily && data.daily.weather_code && data.daily.weather_code.length > 0) {
      const wmoCode = data.daily.weather_code[0];
      const temperatureMax = Math.round(data.daily.temperature_2m_max[0]);
      const temperatureMin = Math.round(data.daily.temperature_2m_min[0]);
      const description = getWeatherDescription(wmoCode);
      const result: Weather = {
        wmoCode,
        description,
        temperatureMin,
        temperatureMax,
      };
      await debugLog.info('Weather fetch success', JSON.stringify(result));
      return result;
    }

    await debugLog.warn('Weather fetch: no data in response');
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await debugLog.error('Weather fetch failed', errorMessage);
    return null;
  }
}
