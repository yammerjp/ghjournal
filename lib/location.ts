import * as ExpoLocation from 'expo-location';
import { Location } from './entry';
import { debugLog } from './debug-log';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ name?: string; shortName?: string }> {
  try {
    const addresses = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });

    if (addresses.length > 0) {
      const addr = addresses[0];

      // デバッグ: addrオブジェクト全体をログに出力
      await debugLog.info('reverseGeocodeAsync result', JSON.stringify(addr, null, 2));

      // street + streetNumber を組み合わせた住所
      const streetAddress = [addr.street, addr.streetNumber].filter(Boolean).join('');

      // nameがstreet+streetNumberと同じ場合は自動生成されたものなので除外
      // 異なる場合は建物名・施設名として使う
      const buildingName = addr.name && addr.name !== streetAddress ? addr.name : null;

      // 日本の住所形式: 都道府県 + 市区町村 + 区 + 町名番地 + 建物名
      const parts = [
        addr.region,           // 都道府県
        addr.city,             // 市区町村
        addr.subregion,        // 区（政令指定都市の場合）
        streetAddress,         // 町名 + 番地
        buildingName,          // 建物名（あれば）
      ].filter(Boolean);

      return {
        name: parts.join(' '),
        shortName: addr.city || undefined,
      };
    }
  } catch (error) {
    console.error('Failed to reverse geocode:', error);
  }
  return {};
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
    const { name, shortName } = await reverseGeocode(latitude, longitude);

    return { latitude, longitude, name, shortName };
  } catch (error) {
    console.error('Failed to get location:', error);
    return null;
  }
}
