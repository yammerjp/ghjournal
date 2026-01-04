import ja from './locales/ja.json';
import en from './locales/en.json';

// Helper to get all keys from nested object
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getAllKeys(value as Record<string, unknown>, newKey);
    }
    return [newKey];
  });
}

describe('i18n translations', () => {
  const jaKeys = getAllKeys(ja);
  const enKeys = getAllKeys(en);

  test('Japanese and English have the same keys', () => {
    const missingInEn = jaKeys.filter(key => !enKeys.includes(key));
    const missingInJa = enKeys.filter(key => !jaKeys.includes(key));

    expect(missingInEn).toEqual([]);
    expect(missingInJa).toEqual([]);
  });

  test('No empty translations in Japanese', () => {
    const emptyKeys = jaKeys.filter(key => {
      const value = key.split('.').reduce((obj, k) => (obj as Record<string, unknown>)[k], ja as unknown);
      return value === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  test('No empty translations in English', () => {
    const emptyKeys = enKeys.filter(key => {
      const value = key.split('.').reduce((obj, k) => (obj as Record<string, unknown>)[k], en as unknown);
      return value === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  // Specific translations tests
  describe('common translations', () => {
    test('cancel button', () => {
      expect(ja.common.cancel).toBe('キャンセル');
      expect(en.common.cancel).toBe('Cancel');
    });

    test('save button', () => {
      expect(ja.common.save).toBe('保存');
      expect(en.common.save).toBe('Save');
    });

    test('delete button', () => {
      expect(ja.common.delete).toBe('削除');
      expect(en.common.delete).toBe('Delete');
    });
  });

  describe('tabs translations', () => {
    test('list tab', () => {
      expect(ja.tabs.list).toBe('リスト');
      expect(en.tabs.list).toBe('List');
    });

    test('calendar tab', () => {
      expect(ja.tabs.calendar).toBe('カレンダー');
      expect(en.tabs.calendar).toBe('Calendar');
    });
  });

  describe('settings translations', () => {
    test('settings title', () => {
      expect(ja.settings.title).toBe('設定');
      expect(en.settings.title).toBe('Settings');
    });

    test('weather section', () => {
      expect(ja.settings.weather.title).toBe('天気');
      expect(en.settings.weather.title).toBe('Weather');
    });
  });

  describe('weekdays translations', () => {
    test('all weekdays exist', () => {
      expect(ja.weekdays.sun).toBe('日');
      expect(ja.weekdays.mon).toBe('月');
      expect(ja.weekdays.tue).toBe('火');
      expect(ja.weekdays.wed).toBe('水');
      expect(ja.weekdays.thu).toBe('木');
      expect(ja.weekdays.fri).toBe('金');
      expect(ja.weekdays.sat).toBe('土');

      expect(en.weekdays.sun).toBe('Sun');
      expect(en.weekdays.mon).toBe('Mon');
      expect(en.weekdays.tue).toBe('Tue');
      expect(en.weekdays.wed).toBe('Wed');
      expect(en.weekdays.thu).toBe('Thu');
      expect(en.weekdays.fri).toBe('Fri');
      expect(en.weekdays.sat).toBe('Sat');
    });
  });
});
