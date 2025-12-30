# ghjournal

ローカルファーストの日記アプリ。GitHubプライベートリポジトリを使って複数デバイス間で同期します。

## 特徴

- **ローカルファースト**: オフラインでも完全に動作
- **GitHub同期**: プライベートリポジトリに日記をMarkdown形式で保存
- **1日1エントリ**: シンプルな日記管理
- **位置情報・天気記録**: 日記に自動で付与（オプション）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. GitHub OAuth Appの作成

1. [GitHub Developer Settings](https://github.com/settings/developers) にアクセス
2. 「New OAuth App」をクリック
3. 以下を設定:
   - Application name: `ghjournal` (任意)
   - Homepage URL: `https://github.com/yourusername/ghjournal`
   - Authorization callback URL: `ghjournal://oauth` (使用しないがRequired)
4. 「Register application」をクリック
5. Client IDをコピー

### 3. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を編集:

```
EXPO_PUBLIC_GITHUB_CLIENT_ID=your_client_id_here
```

### 4. Development Buildの作成

このアプリは `expo-secure-store` を使用するため、Expo Goではなくdevelopment buildが必要です。

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

## 使い方

### 初回起動

1. アプリを起動
2. 日記を書き始める（オフラインで動作）

### GitHub同期の設定

1. 設定画面を開く
2. 「GitHubに接続」をタップ
3. 表示される認証コードをコピー
4. GitHubで認証コードを入力
5. 同期用のプライベートリポジトリを入力（例: `username/my-journal`）
6. 「今すぐ同期」で同期開始

### リポジトリ構造

同期されたリポジトリには以下の構造でファイルが保存されます:

```
ghjournal/
  entries/
    2025-01-15.md
    2025-01-16.md
    ...
```

各ファイルはYAML frontmatter付きのMarkdown形式:

```markdown
---
title: 今日のタイトル
date: 2025-01-15
location:
  latitude: 35.6762
  longitude: 139.6503
  description: 東京都渋谷区
weather:
  wmo_code: 1
  description: 晴れ
  temperature_min: 5.2
  temperature_max: 12.8
created_at: 2025-01-15T10:30:00+09:00
updated_at: 2025-01-15T14:20:00+09:00
---

日記の本文
```

## 開発

### テスト

```bash
npm test
```

### 型チェック

```bash
npx tsc --noEmit
```

## 技術スタック

- [Expo](https://expo.dev/) / React Native
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) - ローカルデータベース
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) - トークン保存
- GitHub API - 同期

## ライセンス

MIT
