import AsyncStorage from '@react-native-async-storage/async-storage';

const WEATHER_ENABLED = 'weather_enabled';

export async function isWeatherEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(WEATHER_ENABLED);
  return value === 'true';
}

export async function setWeatherEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WEATHER_ENABLED, enabled ? 'true' : 'false');
}
