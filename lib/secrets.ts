import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENWEATHER_API_KEY = 'openweather_api_key';
const WEATHER_ENABLED = 'weather_enabled';

export async function getOpenWeatherApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(OPENWEATHER_API_KEY);
}

export async function setOpenWeatherApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(OPENWEATHER_API_KEY, apiKey);
}

export async function deleteOpenWeatherApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(OPENWEATHER_API_KEY);
}

export async function isWeatherEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(WEATHER_ENABLED);
  return value === 'true';
}

export async function setWeatherEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WEATHER_ENABLED, enabled ? 'true' : 'false');
}
