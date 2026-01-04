import {
  entryToMarkdown,
  markdownToEntry,
  parseMarkdownFrontmatter,
} from './entry-format';
import { Entry } from './entry';

describe('entry-format', () => {
  const fullEntry: Entry = {
    id: '01HW123456789ABCDEFGHJKLMN',
    date: '2025-01-15',
    title: '今日の日記',
    content: '今日は良い天気でした。\n\n散歩に行きました。',
    location_latitude: 35.6762,
    location_longitude: 139.6503,
    location_description: '東京都渋谷区',
    location_city: '渋谷区',
    weather_wmo_code: 1,
    weather_description: '晴れ',
    weather_temperature_min: 5.2,
    weather_temperature_max: 12.8,
    weather_symbol_name: null,
    created_at: '2025-01-15T10:30:00+09:00',
    updated_at: '2025-01-15T14:20:00+09:00',
    sync_status: 'committed',
    synced_sha: 'abc123',
  };

  const minimalEntry: Entry = {
    id: '01HW987654321ZYXWVUTSRQPON',
    date: '2025-01-16',
    title: '',
    content: 'シンプルな日記',
    location_latitude: null,
    location_longitude: null,
    location_description: null,
    location_city: null,
    weather_wmo_code: null,
    weather_description: null,
    weather_temperature_min: null,
    weather_temperature_max: null,
    weather_symbol_name: null,
    created_at: '2025-01-16T08:00:00+09:00',
    updated_at: '2025-01-16T08:00:00+09:00',
    sync_status: 'uncommitted',
    synced_sha: null,
  };

  describe('entryToMarkdown', () => {
    it('should convert full entry to markdown with frontmatter', () => {
      const markdown = entryToMarkdown(fullEntry);

      expect(markdown).toContain('---');
      expect(markdown).toContain('title: 今日の日記');
      expect(markdown).toContain('date: 2025-01-15');
      expect(markdown).toContain('latitude: 35.6762');
      expect(markdown).toContain('longitude: 139.6503');
      expect(markdown).toContain('description: 東京都渋谷区');
      expect(markdown).toContain('city: 渋谷区');
      expect(markdown).toContain('wmo_code: 1');
      expect(markdown).toContain('temperature_min: 5.2');
      expect(markdown).toContain('temperature_max: 12.8');
      expect(markdown).toContain('created_at: 2025-01-15T10:30:00+09:00');
      expect(markdown).toContain('updated_at: 2025-01-15T14:20:00+09:00');
      expect(markdown).toContain('今日は良い天気でした。');
      expect(markdown).toContain('散歩に行きました。');
    });

    it('should convert minimal entry to markdown', () => {
      const markdown = entryToMarkdown(minimalEntry);

      expect(markdown).toContain('---');
      expect(markdown).toContain('date: 2025-01-16');
      expect(markdown).not.toContain('title:');
      expect(markdown).not.toContain('location:');
      expect(markdown).not.toContain('weather:');
      expect(markdown).toContain('シンプルな日記');
    });

    it('should handle entry with only location', () => {
      const entry: Entry = {
        ...minimalEntry,
        location_latitude: 35.0,
        location_longitude: 139.0,
      };
      const markdown = entryToMarkdown(entry);

      expect(markdown).toContain('location:');
      expect(markdown).toContain('latitude: 35');
      expect(markdown).toContain('longitude: 139');
    });

    it('should handle entry with only weather', () => {
      const entry: Entry = {
        ...minimalEntry,
        weather_wmo_code: 3,
        weather_description: '曇り',
      };
      const markdown = entryToMarkdown(entry);

      expect(markdown).toContain('weather:');
      expect(markdown).toContain('wmo_code: 3');
      expect(markdown).toContain('description: 曇り');
    });
  });

  describe('markdownToEntry', () => {
    it('should parse full markdown to entry', () => {
      const markdown = `---
title: 今日の日記
date: 2025-01-15
location:
  latitude: 35.6762
  longitude: 139.6503
  description: 東京都渋谷区
  city: 渋谷区
weather:
  wmo_code: 1
  description: 晴れ
  temperature_min: 5.2
  temperature_max: 12.8
created_at: 2025-01-15T10:30:00+09:00
updated_at: 2025-01-15T14:20:00+09:00
---

今日は良い天気でした。

散歩に行きました。`;

      const entry = markdownToEntry(markdown, 'test-id');

      expect(entry.id).toBe('test-id');
      expect(entry.date).toBe('2025-01-15');
      expect(entry.title).toBe('今日の日記');
      expect(entry.content).toBe('今日は良い天気でした。\n\n散歩に行きました。');
      expect(entry.location_latitude).toBe(35.6762);
      expect(entry.location_longitude).toBe(139.6503);
      expect(entry.location_description).toBe('東京都渋谷区');
      expect(entry.location_city).toBe('渋谷区');
      expect(entry.weather_wmo_code).toBe(1);
      expect(entry.weather_description).toBe('晴れ');
      expect(entry.weather_temperature_min).toBe(5.2);
      expect(entry.weather_temperature_max).toBe(12.8);
      expect(entry.created_at).toBe('2025-01-15T10:30:00+09:00');
      expect(entry.updated_at).toBe('2025-01-15T14:20:00+09:00');
    });

    it('should parse minimal markdown to entry', () => {
      const markdown = `---
date: 2025-01-16
created_at: 2025-01-16T08:00:00+09:00
updated_at: 2025-01-16T08:00:00+09:00
---

シンプルな日記`;

      const entry = markdownToEntry(markdown, 'test-id');

      expect(entry.id).toBe('test-id');
      expect(entry.date).toBe('2025-01-16');
      expect(entry.title).toBe('');
      expect(entry.content).toBe('シンプルな日記');
      expect(entry.location_latitude).toBeNull();
      expect(entry.location_longitude).toBeNull();
      expect(entry.location_description).toBeNull();
      expect(entry.location_city).toBeNull();
      expect(entry.weather_wmo_code).toBeNull();
      expect(entry.weather_description).toBeNull();
      expect(entry.weather_temperature_min).toBeNull();
      expect(entry.weather_temperature_max).toBeNull();
    });

    it('should handle markdown without frontmatter', () => {
      const markdown = 'ただのテキスト';

      const entry = markdownToEntry(markdown, 'test-id');

      expect(entry.content).toBe('ただのテキスト');
      expect(entry.date).toBe(''); // date is required in frontmatter
    });

    it('should handle empty content', () => {
      const markdown = `---
date: 2025-01-17
created_at: 2025-01-17T00:00:00Z
updated_at: 2025-01-17T00:00:00Z
---`;

      const entry = markdownToEntry(markdown, 'test-id');

      expect(entry.content).toBe('');
    });
  });

  describe('parseMarkdownFrontmatter', () => {
    it('should parse frontmatter and body', () => {
      const markdown = `---
title: テスト
date: 2025-01-15
---

本文です`;

      const { frontmatter, body } = parseMarkdownFrontmatter(markdown);

      expect(frontmatter).toContain('title: テスト');
      expect(body).toBe('本文です');
    });

    it('should handle no frontmatter', () => {
      const markdown = 'フロントマターなし';

      const { frontmatter, body } = parseMarkdownFrontmatter(markdown);

      expect(frontmatter).toBe('');
      expect(body).toBe('フロントマターなし');
    });

    it('should handle empty body', () => {
      const markdown = `---
date: 2025-01-15
---`;

      const { frontmatter, body } = parseMarkdownFrontmatter(markdown);

      expect(frontmatter).toContain('date: 2025-01-15');
      expect(body).toBe('');
    });
  });

  describe('roundtrip', () => {
    it('should preserve full entry through markdown roundtrip', () => {
      const markdown = entryToMarkdown(fullEntry);
      const parsed = markdownToEntry(markdown, fullEntry.id);

      expect(parsed.date).toBe(fullEntry.date);
      expect(parsed.title).toBe(fullEntry.title);
      expect(parsed.content).toBe(fullEntry.content);
      expect(parsed.location_latitude).toBe(fullEntry.location_latitude);
      expect(parsed.location_longitude).toBe(fullEntry.location_longitude);
      expect(parsed.location_description).toBe(fullEntry.location_description);
      expect(parsed.location_city).toBe(fullEntry.location_city);
      expect(parsed.weather_wmo_code).toBe(fullEntry.weather_wmo_code);
      expect(parsed.weather_description).toBe(fullEntry.weather_description);
      expect(parsed.weather_temperature_min).toBe(fullEntry.weather_temperature_min);
      expect(parsed.weather_temperature_max).toBe(fullEntry.weather_temperature_max);
      expect(parsed.created_at).toBe(fullEntry.created_at);
      expect(parsed.updated_at).toBe(fullEntry.updated_at);
    });

    it('should preserve minimal entry through markdown roundtrip', () => {
      const markdown = entryToMarkdown(minimalEntry);
      const parsed = markdownToEntry(markdown, minimalEntry.id);

      expect(parsed.date).toBe(minimalEntry.date);
      expect(parsed.title).toBe(minimalEntry.title);
      expect(parsed.content).toBe(minimalEntry.content);
      expect(parsed.location_latitude).toBeNull();
      expect(parsed.location_longitude).toBeNull();
      expect(parsed.weather_wmo_code).toBeNull();
    });
  });
});
