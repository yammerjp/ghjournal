import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import LocationPickerModal from './LocationPickerModal';
import { searchLocations } from '../lib/location';

jest.mock('../lib/location', () => ({
  getCurrentLocation: jest.fn().mockResolvedValue(null),
  reverseGeocode: jest.fn().mockResolvedValue({}),
  searchLocations: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.cancel': 'Cancel',
        'common.done': 'Done',
        'common.error': 'Error',
        'entry.selectLocation': 'Select location',
        'entry.noLocationSelected': 'No location selected',
        'entry.useCurrentLocation': 'Current Location',
        'entry.clear': 'Clear',
        'entry.searchPlaceholder': 'Enter address or place name',
        'entry.search': 'Search',
        'entry.locationNotFound': 'Location not found',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
    }));
    return React.createElement(View, props);
  });
  return {
    __esModule: true,
    default: MockMapView,
    Marker: View,
  };
});

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Ionicons: View,
  };
});

const mockSearchLocations = searchLocations as jest.Mock;

describe('LocationPickerModal', () => {
  const defaultProps = {
    visible: true,
    initialLocation: null,
    onClose: jest.fn(),
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('検索UI', () => {
    it('検索入力フィールドが表示される', () => {
      const { getByPlaceholderText } = render(
        <LocationPickerModal {...defaultProps} />
      );
      expect(getByPlaceholderText('Enter address or place name')).toBeTruthy();
    });
  });

  describe('検索動作', () => {
    it('エンターキーを押すとsearchLocationsが呼ばれる', async () => {
      mockSearchLocations.mockResolvedValue([
        { latitude: 35.6812, longitude: 139.7671, name: '東京駅', shortName: '千代田区' },
      ]);

      const { getByPlaceholderText } = render(
        <LocationPickerModal {...defaultProps} />
      );

      const input = getByPlaceholderText('Enter address or place name');
      fireEvent.changeText(input, '東京駅');

      await act(async () => {
        fireEvent(input, 'submitEditing');
      });

      expect(mockSearchLocations).toHaveBeenCalledWith('東京駅');
    });

    it('複数の検索結果がリストで表示される', async () => {
      mockSearchLocations.mockResolvedValue([
        { latitude: 35.6812, longitude: 139.7671, name: '東京駅', shortName: '千代田区' },
        { latitude: 34.6937, longitude: 135.5023, name: '大阪駅', shortName: '大阪市' },
      ]);

      const { getByPlaceholderText, findByText } = render(
        <LocationPickerModal {...defaultProps} />
      );

      const input = getByPlaceholderText('Enter address or place name');
      fireEvent.changeText(input, '駅');

      await act(async () => {
        fireEvent(input, 'submitEditing');
      });

      expect(await findByText('東京駅')).toBeTruthy();
      expect(await findByText('大阪駅')).toBeTruthy();
    });

    it('検索結果をタップすると選択される', async () => {
      mockSearchLocations.mockResolvedValue([
        { latitude: 35.6812, longitude: 139.7671, name: '東京駅', shortName: '千代田区' },
        { latitude: 34.6937, longitude: 135.5023, name: '大阪駅', shortName: '大阪市' },
      ]);

      const { getByPlaceholderText, findByText, queryByText } = render(
        <LocationPickerModal {...defaultProps} />
      );

      const input = getByPlaceholderText('Enter address or place name');
      fireEvent.changeText(input, '駅');

      await act(async () => {
        fireEvent(input, 'submitEditing');
      });

      const tokyoResult = await findByText('東京駅');
      await act(async () => {
        fireEvent.press(tokyoResult);
      });

      // 選択後、リストが閉じて検索結果が消える
      await waitFor(() => {
        expect(queryByText('大阪駅')).toBeNull();
      });
    });

    it('検索結果が見つからない場合エラーメッセージ表示', async () => {
      mockSearchLocations.mockResolvedValue([]);
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByPlaceholderText } = render(
        <LocationPickerModal {...defaultProps} />
      );

      const input = getByPlaceholderText('Enter address or place name');
      fireEvent.changeText(input, 'xxxyyy');

      await act(async () => {
        fireEvent(input, 'submitEditing');
      });

      expect(alertSpy).toHaveBeenCalledWith('Error', 'Location not found');
    });
  });
});
