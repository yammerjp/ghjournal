# 同期設計ドキュメント

## 概要

diary.db はローカルファーストの日記アプリ。複数デバイス間での同期を iCloud Drive または Google Drive 経由で実現する。

## 設計原則

1. **ローカルファースト**: オフラインでも完全に動作
2. **1デバイス1ファイル**: 各デバイスは自分のSQLiteファイルにのみ書き込む
3. **一方向データフロー**: 自分のstream → リモート → local.sqlite3
4. **マイグレーションはローカルで**: リモートのファイルは触らない、必要ならローカルでマイグレーション

## ファイル構造

### リモート（iCloud Drive / Google Drive）

```
/streams/
  {stream_id}.sqlite3.gz   -- gzip圧縮、各デバイスが自分のファイルにのみ書き込む
/blobs/
  {blob_id}                -- 画像等（拡張子なし、UUID）
```

### ローカル

```
local.sqlite3           -- 全デバイス統合済み（読み書き両方）
my_stream.sqlite3       -- 自分のstream（→ gzip してアップロード）
cache/
  streams/              -- Pull時の一時ファイル置き場
  blobs/
    {blob_id}           -- オンデマンドでダウンロード・キャッシュ
```

## ストリーム（Stream）

各デバイスのSQLiteファイルに対応する単位。

- **ID**: ULID形式
- **作成タイミング**: `my_stream.sqlite3` がローカルにないとき（初回起動、再インストール等）
- 各デバイスは自分のストリームにのみ書き込む

## SQLiteスキーマ

### バージョン管理

```sql
PRAGMA user_version = 1;  -- スキーマバージョン
```

### stream.sqlite3（リモート同期用）

```sql
CREATE TABLE diary_versions (
  id TEXT PRIMARY KEY,              -- ULID（バージョンID）
  diary_id TEXT NOT NULL,           -- 日記のID（版をまたいで同一）
  title TEXT NOT NULL,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  content TEXT NOT NULL,
  location_latitude REAL,
  location_longitude REAL,
  location_description TEXT,
  location_city TEXT,
  weather_wmo_code INTEGER,
  weather_description TEXT,
  weather_temperature_min REAL,
  weather_temperature_max REAL,
  blob_ids TEXT,                    -- JSON配列: ["uuid1", "uuid2"]
  archived_at TEXT,                 -- NULL: 表示, 日付: アーカイブ済み
  created_at TEXT NOT NULL
);

CREATE TABLE blobs (
  id TEXT PRIMARY KEY,              -- UUID
  format TEXT NOT NULL,             -- 'webp', 'jpeg', etc.
  created_at TEXT NOT NULL
);
```

### local.sqlite3（ローカル統合用）

```sql
-- 全デバイスのデータ統合済み
CREATE TABLE diary_versions (...);  -- 同上

CREATE TABLE blobs (...);           -- 同上

-- 各日記の最新バージョンを指す
CREATE TABLE diary_heads (
  diary_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL          -- diary_versions.id
);

-- 編集中の下書き（バージョン未確定）
CREATE TABLE diary_drafts (
  diary_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  -- ... 他のカラムは diary_versions と同じ
  blob_ids TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ストリームのメタデータ + 取り込み状況
CREATE TABLE streams (
  stream_id TEXT PRIMARY KEY,
  name TEXT,                        -- デバイス名
  imported_file_size INTEGER,       -- 最後に取り込んだ時のファイルサイズ
  imported_file_mtime INTEGER,      -- 最後に取り込んだ時のmtimeMs
  imported_at TEXT                  -- 最後に取り込んだ時刻
);

-- 最新版を見るためのビュー
CREATE VIEW diaries AS
SELECT dv.* FROM diary_versions dv
JOIN diary_heads dh ON dv.id = dh.version_id;
```

## 同期フロー

### 編集時

- `local.sqlite3` の `diary_drafts` に自動保存
- この時点ではバージョン未確定

### 同期実行時

**Push:**
1. `local.sqlite3` の `diary_drafts` → `my_stream.sqlite3` の `diaries` に移動（バージョン確定）
2. `diary_drafts` から削除
3. `my_stream.sqlite3` を gzip 圧縮
4. リモートにアップロード（`/streams/{my_stream_id}.sqlite3.gz`）

**Pull:**
1. リモートの `/streams/` を列挙
2. 各ファイルの `stat()` で変更検知（`size` + `mtimeMs`）
3. 変更があればダウンロード → 一時ファイルに解凍
4. バージョン違えばマイグレーション
5. `INSERT OR IGNORE` で `local.sqlite3` の `diary_versions`, `blobs` にマージ
6. `diary_heads` を更新（各 `diary_id` の最新 `version_id` を設定）
7. 一時ファイル削除
8. `streams` テーブルを更新

## 画像（Blob）

- 形式: WebP（Full HD、中品質で150-250KB/枚）
- 拡張子なし、形式は `blobs` テーブルで管理
- UUID で衝突なし、どのデバイスからも書き込み可
- ローカルにはオンデマンドでダウンロード（表示時に必要なら取得）

## マイグレーション

- `PRAGMA user_version` でバージョン管理
- バージョンが異なる場合、ローカルでマイグレーションしてから取り込み

## 競合解決

- 同じ日記が複数デバイスにある場合: `updated_at` が新しい方を優先
- ローカルで編集中にリモートから更新が来た場合: ユーザーに通知

