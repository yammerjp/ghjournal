import * as ExpoLocation from 'expo-location';
import { Location } from './diary';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<Location | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const location = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // Reverse geocode to get address
    const addresses = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    let name: string | undefined;

    let shortName: string | undefined;

    if (addresses.length > 0) {
      const addr = addresses[0];
      // 日本の住所形式: 都道府県 + 市区町村 + 地区 + 番地 + 建物名
      const parts = [
        addr.region,           // 都道府県
        addr.city,             // 市区町村
        addr.district,         // 地区・町名
        addr.streetNumber,     // 番地
        addr.name,             // 建物名・施設名
      ].filter(Boolean);
      name = parts.join(' ');

      // 短い表記: 市区町村のみ
      shortName = addr.city || undefined;
    }

    return { latitude, longitude, name, shortName };
  } catch (error) {
    console.error('Failed to get location:', error);
    return null;
  }
}
