import * as ExpoLocation from 'expo-location';
import { geocodeAddress, searchLocations } from './location';

jest.mock('expo-location', () => ({
  geocodeAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mockGeocodeAsync = ExpoLocation.geocodeAsync as jest.Mock;
const mockReverseGeocodeAsync = ExpoLocation.reverseGeocodeAsync as jest.Mock;

describe('geocodeAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('住所文字列から座標を取得できる', async () => {
    mockGeocodeAsync.mockResolvedValue([
      { latitude: 35.6812, longitude: 139.7671 },
    ]);
    mockReverseGeocodeAsync.mockResolvedValue([
      { city: '千代田区', street: '丸の内', region: '東京都' },
    ]);

    const result = await geocodeAddress('東京駅');

    expect(mockGeocodeAsync).toHaveBeenCalledWith('東京駅');
    expect(result).toEqual({
      latitude: 35.6812,
      longitude: 139.7671,
      name: expect.any(String),
      shortName: '千代田区',
    });
  });

  it('空文字列の場合nullを返す', async () => {
    const result = await geocodeAddress('');

    expect(result).toBeNull();
    expect(mockGeocodeAsync).not.toHaveBeenCalled();
  });

  it('空白のみの文字列の場合nullを返す', async () => {
    const result = await geocodeAddress('   ');

    expect(result).toBeNull();
    expect(mockGeocodeAsync).not.toHaveBeenCalled();
  });

  it('結果が見つからない場合nullを返す', async () => {
    mockGeocodeAsync.mockResolvedValue([]);

    const result = await geocodeAddress('存在しない場所xxxyyy');

    expect(result).toBeNull();
  });

  it('APIエラーの場合nullを返す', async () => {
    mockGeocodeAsync.mockRejectedValue(new Error('Network error'));

    const result = await geocodeAddress('東京');

    expect(result).toBeNull();
  });

  it('複数の候補がある場合、最初の結果を使用する', async () => {
    mockGeocodeAsync.mockResolvedValue([
      { latitude: 35.6812, longitude: 139.7671 },
      { latitude: 34.6937, longitude: 135.5023 },
    ]);
    mockReverseGeocodeAsync.mockResolvedValue([{ city: '千代田区' }]);

    const result = await geocodeAddress('駅');

    expect(result?.latitude).toBe(35.6812);
    expect(result?.longitude).toBe(139.7671);
  });
});

describe('searchLocations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('複数の検索結果を配列で返す', async () => {
    mockGeocodeAsync.mockResolvedValue([
      { latitude: 35.6812, longitude: 139.7671 },
      { latitude: 34.6937, longitude: 135.5023 },
    ]);
    mockReverseGeocodeAsync
      .mockResolvedValueOnce([{ city: '千代田区', region: '東京都' }])
      .mockResolvedValueOnce([{ city: '大阪市', region: '大阪府' }]);

    const results = await searchLocations('駅');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      latitude: 35.6812,
      longitude: 139.7671,
      name: expect.any(String),
      shortName: '千代田区',
    });
    expect(results[1]).toEqual({
      latitude: 34.6937,
      longitude: 135.5023,
      name: expect.any(String),
      shortName: '大阪市',
    });
  });

  it('空文字列の場合は空配列を返す', async () => {
    const results = await searchLocations('');

    expect(results).toEqual([]);
    expect(mockGeocodeAsync).not.toHaveBeenCalled();
  });

  it('結果が見つからない場合は空配列を返す', async () => {
    mockGeocodeAsync.mockResolvedValue([]);

    const results = await searchLocations('存在しない場所');

    expect(results).toEqual([]);
  });

  it('APIエラーの場合は空配列を返す', async () => {
    mockGeocodeAsync.mockRejectedValue(new Error('Network error'));

    const results = await searchLocations('東京');

    expect(results).toEqual([]);
  });

  it('1件だけの場合も配列で返す', async () => {
    mockGeocodeAsync.mockResolvedValue([
      { latitude: 35.6812, longitude: 139.7671 },
    ]);
    mockReverseGeocodeAsync.mockResolvedValue([{ city: '千代田区' }]);

    const results = await searchLocations('東京駅');

    expect(results).toHaveLength(1);
  });
});
