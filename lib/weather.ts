import { getOpenWeatherApiKey, isWeatherEnabled } from './secrets';
import { debugLog } from './debug-log';

interface WeatherData {
  weather: {
    main: string;
    description: string;
  }[];
  temp: number;
}

interface OneCallCurrentResponse {
  current: WeatherData;
}

interface OneCallTimeMachineResponse {
  data: WeatherData[];
}

export async function getWeather(
  latitude: number,
  longitude: number,
  date: string
): Promise<string | null> {
  // Check if weather feature is enabled
  const enabled = await isWeatherEnabled();
  if (!enabled) {
    await debugLog.info('Weather fetch skipped: feature disabled');
    return null;
  }

  const apiKey = await getOpenWeatherApiKey();
  if (!apiKey) {
    await debugLog.warn('Weather fetch skipped: no API key');
    return null;
  }

  try {
    await debugLog.info(`Weather fetch started`, `lat=${latitude}, lon=${longitude}, date=${date}`);
    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0); // Use noon for the target date
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDateStart = new Date(date);
    targetDateStart.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - targetDateStart.getTime()) / (1000 * 60 * 60 * 24));

    let url: string;
    let isTimeMachine = false;

    if (diffDays <= 0 && diffDays >= -4) {
      // Today or future (up to 4 days): use current/forecast API
      url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=ja&exclude=minutely,hourly,alerts`;
    } else if (diffDays > 0) {
      // Past date: use timemachine API
      const timestamp = Math.floor(targetDate.getTime() / 1000);
      url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${latitude}&lon=${longitude}&dt=${timestamp}&appid=${apiKey}&units=metric&lang=ja`;
      isTimeMachine = true;
    } else {
      // Too far in the future
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      await debugLog.error(`Weather API error: ${response.status}`, errorText);
      return null;
    }

    let weatherData: WeatherData | undefined;

    if (isTimeMachine) {
      const data: OneCallTimeMachineResponse = await response.json();
      if (data.data && data.data.length > 0) {
        weatherData = data.data[0];
      }
    } else {
      const data: OneCallCurrentResponse = await response.json();
      if (diffDays === 0) {
        // Today: use current weather
        weatherData = data.current;
      } else {
        // Future: would need to use daily forecast, but for simplicity use current
        weatherData = data.current;
      }
    }

    if (weatherData && weatherData.weather && weatherData.weather.length > 0) {
      const weather = weatherData.weather[0];
      const temp = Math.round(weatherData.temp);
      const result = `${weather.description} ${temp}°C`;
      await debugLog.info('Weather fetch success', result);
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
