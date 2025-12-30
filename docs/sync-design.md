# 同期設計ドキュメント

## 概要

ghjournal はローカルファーストの日記アプリ。GitHubプライベートリポジトリを共有ストレージとして使用し、複数デバイス間での同期を実現する。

## 設計原則

1. **ローカルファースト**: オフラインでも完全に動作
2. **Gitに履歴を委任**: バージョン管理はGitHubに任せる
3. **シンプルなCRUD**: append-onlyではなく素朴なテーブル構造
4. **衝突は検知のみ**: 解消はしない（Gitの履歴から復元可能）

## 認証

- GitHub OAuth 2.0 Device Flow でログイン
- スコープ: `repo`（プライベートリポジトリへのアクセス）
- アクセストークンは `expo-secure-store` に保存（iOS: Keychain, Android: Keystore）

### Device Flow の流れ

1. アプリが GitHub API に `device_code` と `user_code` をリクエスト
2. ユーザーに `user_code`（例: `WDJB-MJHT`）を表示
3. ユーザーが `github.com/login/device` をブラウザで開いてコードを入力
4. アプリがポーリングしてアクセストークンを取得
5. トークンを `expo-secure-store` に保存

### GitHub API

```
POST https://github.com/login/device/code
Content-Type: application/json

{
  "client_id": "YOUR_CLIENT_ID",
  "scope": "repo"
}
```

レスポンス:
```json
{
  "device_code": "xxx",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://github.com/login/device",
  "expires_in": 900,
  "interval": 5
}
```

トークン取得（ポーリング）:
```
POST https://github.com/login/oauth/access_token
Content-Type: application/json

{
  "client_id": "YOUR_CLIENT_ID",
  "device_code": "xxx",
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
}
```

## リモート（GitHubリポジトリ）

```
/ghjournal/
  entries/
    2025-01-15.md
  attachments/
    2025-01-15/
      a1b2c3d4e5f6.webp   -- SHA-1の先頭12文字 + 拡張子
      sunset.webp          -- 手動追加も可（任意のファイル名）
```

- 添付ファイルはエントリの日付ディレクトリに保存
- アプリからはコンテンツのSHA-1ハッシュで命名（衝突時は同一ファイル）
- 手動追加の場合は任意のファイル名でOK

### エントリファイル形式

```markdown
---
title: タイトル
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

日記の本文がここに入る。

Markdown形式で自由に記述。
```

## ローカル（SQLite3）

1つのSQLite3ファイルのみ使用。

### スキーマ

```sql
PRAGMA user_version = 1;

CREATE TABLE entries (
  id TEXT PRIMARY KEY,              -- ULID
  date TEXT NOT NULL UNIQUE,        -- YYYY-MM-DD（1日1エントリ）
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  location_latitude REAL,
  location_longitude REAL,
  location_description TEXT,
  location_city TEXT,
  weather_wmo_code INTEGER,
  weather_description TEXT,
  weather_temperature_min REAL,
  weather_temperature_max REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- 同期用
  sync_status TEXT NOT NULL DEFAULT 'uncommitted',  -- 'committed' | 'uncommitted'
  synced_sha TEXT                   -- 最後に同期したblob SHA（null = 新規）
);

CREATE INDEX idx_entries_date ON entries(date);
CREATE INDEX idx_entries_sync_status ON entries(sync_status);

-- 添付ファイル（Tree APIの結果をキャッシュ）
CREATE TABLE attachments (
  path TEXT PRIMARY KEY,            -- "ghjournal/attachments/2025-01-15/a1b2c3.webp"
  date TEXT NOT NULL,               -- "2025-01-15"（どのエントリに属するか）
  filename TEXT NOT NULL,           -- "a1b2c3.webp"
  sha TEXT NOT NULL,                -- GitHubのblob SHA
  is_downloaded INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_attachments_date ON attachments(date);

-- GitHub接続情報（access_tokenはexpo-secure-storeに保存）
CREATE TABLE github_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- シングルトン
  repository TEXT,                  -- "owner/repo" 形式
  connected_at TEXT
);
```

### sync_status の意味

- `committed`: リモートと同期済み。`synced_sha` のハッシュとコンテンツが一致するはず
- `uncommitted`: ローカルで変更あり。`synced_sha` は変更前のベースを示す

### synced_sha の意味

- 最後に同期したファイルの blob SHA（Git の blob オブジェクトのSHA-1）
- `null`: まだリモートに存在しない新規エントリ
- 衝突検知に使用: pull時にリモートのSHAが `synced_sha` と異なれば衝突

## 同期フロー

### Push（ローカル → GitHub）

1. `sync_status = 'uncommitted'` のエントリを取得
2. 各エントリをMarkdown形式に変換
3. GitHub Content API で commit
   - 新規: `PUT /repos/{owner}/{repo}/contents/ghjournal/entries/{date}.md`
   - 更新: 同上（`sha` パラメータに `synced_sha` を指定）
4. 成功したら `sync_status = 'committed'`、`synced_sha` を更新

### Pull（GitHub → ローカル）

1. GitHub API でリポジトリの `ghjournal/entries/` を列挙
2. 各ファイルについて:
   - ローカルにない → 新規作成（`sync_status = 'committed'`）
   - ローカルにある & `sync_status = 'committed'` & SHA異なる → 更新
   - ローカルにある & `sync_status = 'uncommitted'` & SHA異なる → **衝突検知**
3. ローカルにあるがリモートにない:
   - `sync_status = 'committed'` → リモートで削除された、ローカルも削除
   - `sync_status = 'uncommitted'` → ローカルで新規作成、そのまま

### 衝突検知

Pull時に以下の条件で衝突を検知:
- ローカルで `sync_status = 'uncommitted'`
- かつ `synced_sha` がリモートの現在のSHAと異なる

**衝突時の挙動:**
- ユーザーに通知（「他のデバイスで更新されました」）
- 解消はしない（次のPushで上書きすればよい、履歴はGitに残る）

## GitHub API

### 認証

```
Authorization: Bearer {access_token}
```

### エントリ一覧取得（Tree API）

Contents API は1,000ファイル制限があるため、Tree API を使用。

```
GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
```

レスポンス例:
```json
{
  "sha": "abc123...",
  "tree": [
    { "path": "ghjournal/entries/2025-01-01.md", "sha": "def456...", "type": "blob" },
    { "path": "ghjournal/entries/2025-01-02.md", "sha": "ghi789...", "type": "blob" },
    { "path": "ghjournal/attachments/2025-01-01/a1b2c3.webp", "sha": "jkl012...", "type": "blob" },
    ...
  ],
  "truncated": false
}
```

- `recursive=1`: 全階層を一括取得（最大100,000エントリ、7MB）
- `truncated: true` の場合は結果が切り詰められている

### ファイル取得

```
GET /repos/{owner}/{repo}/contents/ghjournal/entries/{date}.md
```

### ファイル作成/更新

```
PUT /repos/{owner}/{repo}/contents/ghjournal/entries/{date}.md
Content-Type: application/json

{
  "message": "Update 2025-01-15",
  "content": "{base64エンコードされた内容}",
  "sha": "{更新時のみ、既存ファイルのsynced_sha}"
}
```

### ファイル削除

```
DELETE /repos/{owner}/{repo}/contents/ghjournal/entries/{date}.md
Content-Type: application/json

{
  "message": "Delete 2025-01-15",
  "sha": "{既存ファイルのsynced_sha}"
}
```

## 添付ファイル

- 形式: WebP 推奨（Full HD、中品質で150-250KB/枚）
- 保存先: `/ghjournal/attachments/{date}/` ディレクトリ
- ファイル名: アプリからはSHA-1ハッシュ、手動追加は任意

### 添付ファイルの同期

- Pull時: Tree APIの結果から `ghjournal/attachments/` 以下を抽出し `attachments` テーブルに記録
- 表示時: `is_downloaded = 0` ならダウンロードしてローカルに保存、`is_downloaded = 1` に更新
- ローカルキャッシュは `{documentDirectory}/attachments/{date}/{filename}` に保存

## 初回セットアップ

### アプリ起動時

- GitHub連携なしですぐに使い始められる
- 記事はローカルSQLiteに保存（`sync_status = 'uncommitted'`）
- オフラインでも完全に動作

### GitHub連携時（設定画面から）

1. GitHubでOAuthログイン
2. 使用するリポジトリを選択（事前にGitHub上で作成しておく）
3. `github_config` テーブルに保存
4. Pull実行（リモートに既存データがあれば取り込み）
5. Push実行（ローカルの未同期データをアップロード）

### 連携後の通常フロー

- 同期ボタン押下時: Pull → Push の順で実行
- 衝突があればユーザーに通知
