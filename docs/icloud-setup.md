# iCloud セットアップ手順

Apple Developer Program 登録後に iCloud を有効化する手順。

## 前提条件

- Apple Developer Program に登録済み（年間 $99）
- Xcode で Team に Developer Program のチームを選択できる状態

## 1. Apple Developer Portal での設定

1. [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/cloudContainer) にアクセス
2. 「Identifiers」→「iCloud Containers」→「+」
3. Identifier: `iCloud.jp.yammer.diarydb` を入力して作成

## 2. app.json の更新

`plugins` 配列に `react-native-cloud-storage` を追加:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-cloud-storage",
        {
          "iCloudContainerEnvironment": "Production"
        }
      ]
    ]
  }
}
```

### オプション

- `iCloudContainerEnvironment`: `"Production"` または `"Development"`（デフォルト: `"Production"`）
- `iCloudContainerIdentifier`: 明示的に指定する場合（デフォルト: `iCloud.{bundleIdentifier}`）

## 3. iOS プロジェクトの再生成

```bash
rm -rf ios
npx expo prebuild --platform ios
```

## 4. Xcode で署名設定

1. `ios/diarydb.xcworkspace` を開く
2. TARGETS → diarydb → Signing & Capabilities
3. Team: Developer Program のチームを選択
4. 「+ Capability」→「iCloud」が自動で追加されているか確認
5. iCloud の設定で「CloudKit」と正しいコンテナが選択されているか確認

## 5. ビルド

```bash
npx expo run:ios --device
```

## コードでの使用

```typescript
import { CloudStorage, CloudStorageProvider } from 'react-native-cloud-storage';

// プロバイダーの確認
const provider = CloudStorage.getProvider();
if (provider === CloudStorageProvider.ICloud) {
  // iCloud が利用可能
  await CloudStorage.writeFile('/test.txt', 'Hello iCloud!');
}
```

## 参考リンク

- [react-native-cloud-storage Expo ドキュメント](https://react-native-cloud-storage.oss.kuatsu.de/docs/installation/expo/)
- [Apple Developer - iCloud](https://developer.apple.com/icloud/)
