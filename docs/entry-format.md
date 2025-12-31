# Entry Format Specification

ghjournal stores diary entries as Markdown files with YAML front matter.

## File Location

Entries are stored in the GitHub repository at:

```
ghjournal/entries/YYYY-MM-DD.md
```

Each file represents one day's entry, named by date (e.g., `2025-01-15.md`).

## File Format

```markdown
---
title: Entry Title
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

Entry content goes here.

Multiple paragraphs are supported.
```

## Front Matter Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Entry date in `YYYY-MM-DD` format |
| `created_at` | string | ISO 8601 datetime when entry was created |
| `updated_at` | string | ISO 8601 datetime when entry was last updated |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Entry title (auto-generated from content if empty) |

### Location (Optional Section)

| Field | Type | Description |
|-------|------|-------------|
| `location.latitude` | number | Latitude coordinate |
| `location.longitude` | number | Longitude coordinate |
| `location.description` | string | Full location description |
| `location.city` | string | City/district name (short form) |

### Weather (Optional Section)

| Field | Type | Description |
|-------|------|-------------|
| `weather.wmo_code` | number | WMO weather code (see below) |
| `weather.description` | string | Weather description in Japanese |
| `weather.temperature_min` | number | Minimum temperature (°C) |
| `weather.temperature_max` | number | Maximum temperature (°C) |

## WMO Weather Codes

Common codes used:

| Code | Description |
|------|-------------|
| 0 | 快晴 (Clear sky) |
| 1 | 晴れ (Mainly clear) |
| 2 | 一部曇り (Partly cloudy) |
| 3 | 曇り (Overcast) |
| 45 | 霧 (Fog) |
| 51 | 小雨 (Light drizzle) |
| 53 | 雨 (Moderate drizzle) |
| 55 | 強い雨 (Dense drizzle) |
| 61 | 小雨 (Slight rain) |
| 63 | 雨 (Moderate rain) |
| 65 | 強い雨 (Heavy rain) |
| 71 | 小雪 (Slight snow) |
| 73 | 雪 (Moderate snow) |
| 75 | 大雪 (Heavy snow) |
| 80 | にわか雨 (Rain showers) |
| 95 | 雷雨 (Thunderstorm) |

Full list: https://open-meteo.com/en/docs

## Examples

### Minimal Entry

```markdown
---
date: 2025-01-15
created_at: 2025-01-15T08:00:00+09:00
updated_at: 2025-01-15T08:00:00+09:00
---

今日は特に何もなかった。
```

### Full Entry

```markdown
---
title: 初詣に行った
date: 2025-01-01
location:
  latitude: 35.7148
  longitude: 139.7967
  description: 東京都台東区浅草
  city: 浅草
weather:
  wmo_code: 1
  description: 晴れ
  temperature_min: 2.5
  temperature_max: 10.3
created_at: 2025-01-01T15:30:00+09:00
updated_at: 2025-01-01T18:45:00+09:00
---

朝から浅草寺に初詣に行った。

かなり混んでいたが、無事にお参りできた。
おみくじは大吉だった。

帰りに仲見世で人形焼きを買った。
```

### Entry Without Location/Weather

```markdown
---
title: 読書の記録
date: 2025-01-10
created_at: 2025-01-10T21:00:00+09:00
updated_at: 2025-01-10T22:30:00+09:00
---

「1984年」を読み終えた。

ディストピア小説の金字塔と言われるだけあって、
現代にも通じるテーマが多く考えさせられた。
```

## Notes

- YAML indentation must be 2 spaces for nested fields (location, weather)
- All timestamps should include timezone offset (e.g., `+09:00`)
- Content body follows the closing `---` with a blank line
- Empty content is allowed (front matter only)
