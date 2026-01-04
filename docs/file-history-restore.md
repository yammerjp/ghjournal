# ファイル履歴確認・復元機能 設計ドキュメント

## 概要

日記エントリの過去の状態を確認し、任意のバージョンに復元する機能。
GitHub API を使用して、ファイルのコミット履歴を取得し、過去の内容で新しいコミットを作成することで復元を実現する。

## 必要な GitHub API

### 1. コミット履歴取得

**エンドポイント**: `GET /repos/{owner}/{repo}/commits`

**パラメータ**:
- `path`: ファイルパス（例: `ghjournal/entries/2025-01-15.md`）
- `per_page`: 取得件数（デフォルト30）

**リクエスト例**:
```
GET /repos/owner/repo/commits?path=ghjournal/entries/2025-01-15.md&per_page=30
```

**レスポンス例**:
```json
[
  {
    "sha": "abc123...",
    "commit": {
      "message": "Update 2025-01-15",
      "author": {
        "name": "User Name",
        "date": "2025-01-15T10:30:00Z"
      }
    }
  }
]
```

**ドキュメント**: https://docs.github.com/en/rest/commits/commits

### 2. 特定コミット時点のファイル内容取得

**エンドポイント**: `GET /repos/{owner}/{repo}/contents/{path}?ref={commit_sha}`

**ポイント**: 既存の Contents API に `ref` パラメータを追加するだけ

**リクエスト例**:
```
GET /repos/owner/repo/contents/ghjournal/entries/2025-01-15.md?ref=abc123
```

**レスポンス**: 通常の Contents API と同じ形式（Base64エンコードされたcontent）

**ドキュメント**: https://docs.github.com/en/rest/repos/contents

### 3. ファイル更新（復元コミット作成）

**エンドポイント**: `PUT /repos/{owner}/{repo}/contents/{path}`

**既存実装あり**: `lib/github-sync.ts` の `pushEntries()` で使用中

**リクエストボディ**:
```json
{
  "message": "Restore entry from commit abc123",
  "content": "base64_encoded_content",
  "sha": "current_file_sha"
}
```

## 実装計画

### Phase 1: API 機能追加 (lib/github-sync.ts)

#### 新規関数

```typescript
// 1. コミット履歴取得
interface CommitHistoryItem {
  sha: string;
  message: string;
  authorName: string;
  date: string;
}

export async function fetchCommitHistory(
  token: string,
  repository: string,
  filePath: string,
  limit?: number
): Promise<CommitHistoryItem[]>

// 2. 特定コミット時点のファイル内容取得
export async function fetchFileAtCommit(
  token: string,
  repository: string,
  filePath: string,
  commitSha: string
): Promise<string>  // マークダウン内容

// 3. 復元実行
export async function restoreEntryFromCommit(
  token: string,
  repository: string,
  entry: Entry,
  targetCommitSha: string
): Promise<void>
```

#### 実装パターン

既存コードと同じパターンを使用:
```typescript
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});
```

### Phase 2: UI コンポーネント

#### 新規画面

1. **履歴リスト画面** (`app/entries/[id]/history.tsx`)
   - エントリのコミット履歴を一覧表示
   - 各項目: コミット日時、メッセージ、プレビュー

2. **履歴詳細・復元画面** (`app/entries/[id]/history/[sha].tsx`)
   - 過去バージョンの全文表示
   - 現在との差分表示（オプション）
   - 復元ボタン + 確認ダイアログ

#### 既存画面の変更

- `EntryEditor.tsx`: 履歴ボタン追加

### Phase 3: i18n 対応

```json
// en.json
{
  "history": {
    "title": "Version History",
    "restore": "Restore",
    "restoreConfirm": "Restore this version?",
    "restoreSuccess": "Entry restored",
    "noHistory": "No history available"
  }
}

// ja.json
{
  "history": {
    "title": "変更履歴",
    "restore": "復元",
    "restoreConfirm": "このバージョンに復元しますか？",
    "restoreSuccess": "日記を復元しました",
    "noHistory": "履歴がありません"
  }
}
```

## 工数見積もり

| タスク | 工数 | 備考 |
|--------|------|------|
| API関数実装 | 5-8時間 | 既存パターン利用 |
| API テスト | 2-3時間 | モック設定 |
| 履歴リスト画面 | 4-5時間 | リスト表示 |
| 詳細・復元画面 | 3-4時間 | 確認ダイアログ含む |
| 既存画面変更 | 1-2時間 | 履歴ボタン追加 |
| i18n 対応 | 1-2時間 | |
| インテグレーション | 2-3時間 | ナビゲーション等 |
| **合計** | **20-27時間** | **約3営業日** |

## 技術的な注意点

### GitHub API レート制限

- OAuth トークン: 5,000 リクエスト/時間
- 履歴リスト取得: 1リクエスト
- 各バージョンの内容取得: 1リクエスト/件
- **対策**: 必要に応じてキャッシング検討

### エンコーディング

既存コードと同じ方式:
```typescript
// エンコード
const encoded = btoa(unescape(encodeURIComponent(content)));

// デコード
const decoded = decodeURIComponent(escape(atob(base64Content)));
```

### データベース

- スキーマ変更不要
- 復元後は通常の同期フローで `synced_sha` が更新される

## 関連ファイル

- `lib/github-sync.ts` - GitHub API 呼び出し
- `lib/github-sync.test.ts` - テスト
- `lib/entry-format.ts` - マークダウン変換
- `components/EntryEditor.tsx` - UI参考

## 参考リンク

- [GitHub Commits API](https://docs.github.com/en/rest/commits/commits)
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents)
- [GitHub Git Commits API](https://docs.github.com/en/rest/git/commits)
