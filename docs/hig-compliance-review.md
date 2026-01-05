# Human Interface Guidelines (HIG) 準拠性レビュー

調査日: 2026-01-05
対象: ghjournal iOS/Android アプリ
フレームワーク: React Native (Expo 54.0.30)

---

## 概要

本ドキュメントは、ghjournalアプリのUI実装をApple Human Interface Guidelines (HIG) の観点から調査し、改善点をまとめたものです。

### 総合評価

| 項目 | 準拠度 | 優先度 |
|------|--------|--------|
| タッチターゲット | 40% | 高 |
| アクセシビリティ | 5% | 最高 |
| ダークモード | 10% | 高 |
| Dynamic Type | 20% | 高 |
| ナビゲーション | 60% | 中 |
| モーダル | 70% | 中 |
| セーフエリア | 50% | 中 |
| フォーム入力 | 60% | 中 |
| アイコン | 65% | 低 |
| フィードバック | 75% | 低 |

---

## 1. タッチターゲットサイズ

### 問題

HIGでは、すべてのタップ可能な要素は最小44x44ポイントを確保することを推奨しています。現在の実装では多くの要素がこの基準を満たしていません。

| コンポーネント | 現在のサイズ | 状態 |
|----------------|--------------|------|
| FAB (新規作成ボタン) | 56x56pt | OK |
| 設定ボタン (index.tsx) | ~32x32pt (`padding: 4`) | NG |
| ナビゲーション戻るボタン | ~48x48pt | 境界線 |
| リスト項目 | 高さ不足 (`paddingVertical: 12`) | NG |
| 検索結果項目 | 高さ不足 (`paddingVertical: 12`) | NG |
| メタデータ操作ボタン | 不規則 | NG |

### 問題のあるコード

```typescript
// app/(tabs)/index.tsx:310
settingsButton: {
  padding: 4,  // 24x24アイコン + 4padding = 32x32 (不足)
}

// components/LocationPickerModal.tsx:357
searchResultItem: {
  paddingHorizontal: 16,
  paddingVertical: 12,  // 高さが44pt未満になる可能性
}
```

### 改善案

```typescript
// 統一されたタッチターゲット定数
const MINIMUM_TAP_TARGET = 44;

// すべてのインタラクティブ要素に適用
touchableElement: {
  minHeight: MINIMUM_TAP_TARGET,
  minWidth: MINIMUM_TAP_TARGET,
  justifyContent: 'center',
  alignItems: 'center',
}
```

---

## 2. アクセシビリティ

### 問題

現在の実装では、アクセシビリティ対応がほぼ皆無です。

1. **accessibilityLabel の欠如**: すべてのボタン、アイコンにラベルがない
2. **accessibilityRole の未指定**: 要素の役割が定義されていない
3. **accessibilityHint の未使用**: 操作結果の説明がない
4. **testID の欠如**: 自動テストに対応していない
5. **コントラスト比の問題**: 一部の色組み合わせがWCAG AA未達

### コントラスト比の問題

| 色の組み合わせ | コントラスト比 | WCAG AA |
|----------------|----------------|---------|
| #333 on #fff | 12.6:1 | OK |
| #666 on #fff | 6.0:1 | 境界線 |
| #999 on #fff | 3.0:1 | NG |
| #ccc on #fff | 1.6:1 | NG |

### 問題のあるコード

```typescript
// 現在の実装（アクセシビリティ情報なし）
<TouchableOpacity onPress={() => router.push("/settings")}>
  <Ionicons name="settings-outline" size={24} color="#007AFF" />
</TouchableOpacity>
```

### 改善案

```typescript
// アクセシビリティ情報を追加
<TouchableOpacity
  onPress={() => router.push("/settings")}
  accessibilityLabel="設定"
  accessibilityRole="button"
  accessibilityHint="設定画面を開きます"
  testID="settings-button"
>
  <Ionicons
    name="settings-outline"
    size={24}
    color="#007AFF"
    accessibilityElementsHidden={true}
  />
</TouchableOpacity>
```

---

## 3. ダークモード対応

### 問題

`app.config.ts`で`userInterfaceStyle: "automatic"`が設定されていますが、実際のUI実装ではすべての色がハードコードされており、ダークモードに対応していません。

### 問題のあるコード

```typescript
// 複数ファイルで見られるハードコード色
backgroundColor: "#fff"
color: "#333"
borderColor: "#e0e0e0"
```

### 改善案

```typescript
// lib/colors.ts - 統一カラーシステム
import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#e0e0e0',
    accent: '#007AFF',
    warning: '#FF9500',
    error: '#FF3B30',
  },
  dark: {
    background: '#000000',
    surface: '#1c1c1e',
    text: '#ffffff',
    textSecondary: '#ababab',
    textTertiary: '#8e8e93',
    border: '#38383a',
    accent: '#0A84FF',
    warning: '#FF9F0A',
    error: '#FF453A',
  },
};

export const useThemeColors = () => {
  const colorScheme = useColorScheme();
  return Colors[colorScheme ?? 'light'];
};
```

---

## 4. Dynamic Type 対応

### 問題

すべてのフォントサイズが固定値で指定されており、ユーザーがシステム設定で大きなテキストサイズを選択しても反映されません。

### 現在のフォントサイズ

| 用途 | 現在のサイズ | HIG推奨 |
|------|--------------|---------|
| ヘッダータイトル | 20pt | Large Title: 34pt |
| セクションヘッダー | 13-17pt | Headline: 17pt |
| エントリータイトル | 16pt | Subheadline: 15pt |
| ボディテキスト | 14-16pt | Body: 17pt |
| メタデータ | 12-13pt | Caption 1: 12pt |

### 問題のあるコード

```typescript
headerTitle: {
  fontSize: 20,
  fontWeight: "bold",
}
entryContent: {
  fontSize: 14,
  color: "#666",
}
```

### 改善案

React NativeでDynamic Typeを実装する方法:

```typescript
import { PixelRatio, Text } from 'react-native';

// フォントスケーリングを有効化
<Text
  allowFontScaling={true}
  maxFontSizeMultiplier={1.5}
  style={styles.body}
>
  {content}
</Text>

// または、Expoのアクセシビリティ機能を使用
import * as Font from 'expo-font';

// カスタムフック
const useDynamicFontSize = (baseSize: number) => {
  const fontScale = PixelRatio.getFontScale();
  return baseSize * Math.min(fontScale, 1.5);
};
```

---

## 5. ナビゲーション

### 問題

1. **Large Title パターン未使用**: HIGではスクロール可能なコンテンツでLarge Titleの使用を推奨
2. **ヘッダータイトルの一貫性欠如**: 一部の画面でカスタムヘッダーを使用
3. **モーダル遷移時のナビゲーション体験**: 複数モーダルの管理が限定的

### 改善案

```typescript
// Expo Router でLarge Titleを有効化
<Stack.Screen
  name="(tabs)"
  options={{
    headerLargeTitle: true,
    headerLargeTitleShadowVisible: false,
  }}
/>
```

---

## 6. モーダル

### 良い点

- `presentationStyle="pageSheet"` を使用（HIG推奨）
- 左にCancel、右にDoneの配置（HIG推奨）
- i18n対応済み

### 問題

1. **モーダルヘッダーのタッチターゲット**: ボタンサイズが不規則
2. **スクロールコンテンツ**: 検索結果が固定`maxHeight: 200`
3. **ダークモード未対応**: 白背景固定

### 改善案

```typescript
// モーダルヘッダーのボタン統一
modalHeaderButton: {
  minWidth: 80,
  minHeight: 44,
  justifyContent: 'center',
}
```

---

## 7. セーフエリア

### 問題

1. **ハードコード値の使用**: `paddingTop: 54`などの固定値
2. **SafeAreaViewの非使用**: 動的なセーフエリア対応なし
3. **Dynamic Island対応が不確実**

### 問題のあるコード

```typescript
// app/(tabs)/index.tsx:213
container: {
  flex: 1,
  paddingTop: 54,  // ハードコード
}
```

### 改善案

```typescript
import { SafeAreaView } from 'react-native-safe-area-context';

// SafeAreaViewを使用
<SafeAreaView style={styles.container} edges={['top', 'bottom']}>
  {children}
</SafeAreaView>

// または、フックを使用
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Component = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
};
```

---

## 8. フォーム入力

### 問題

1. **プレースホルダーのコントラスト不足**: `#ccc`はWCAG AA未達
2. **フォーカス状態の視覚フィードバック不足**
3. **入力フィールドの高さ**: 40ptは44pt未満

### 問題のあるコード

```typescript
// components/EntryEditor.tsx
placeholderTextColor="#ccc"  // コントラスト不足

// components/LocationPickerModal.tsx
searchInputWrapper: {
  height: 40,  // 44pt未満
}
```

### 改善案

```typescript
// フォーカス状態の視覚化
const [isFocused, setIsFocused] = useState(false);

<View style={[
  styles.inputWrapper,
  isFocused && styles.inputFocused
]}>
  <TextInput
    onFocus={() => setIsFocused(true)}
    onBlur={() => setIsFocused(false)}
    placeholderTextColor="#8e8e93"  // コントラスト改善
  />
</View>

// スタイル
inputWrapper: {
  minHeight: 44,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#e0e0e0',
}
inputFocused: {
  borderWidth: 2,
  borderColor: '#007AFF',
}
```

---

## 9. アイコン

### 問題

1. **サイズの不規則性**: 12pt〜32ptまでバラバラ
2. **間隔の不統一**: gap値が2〜12まで様々
3. **アクセシビリティラベルの欠如**

### 現在のアイコンサイズ

| 用途 | サイズ |
|------|--------|
| タブアイコン | 設定依存 |
| 検索アイコン | 18pt |
| マップマーカー | 20pt |
| ヘッダーボタン | 24pt |
| FAB | 32pt |

### 改善案

```typescript
// 統一されたアイコンサイズスケール
export const IconSizes = {
  xs: 12,   // インラインラベル横
  sm: 16,   // 小さなインジケータ
  md: 20,   // 標準
  lg: 24,   // ボタン内
  xl: 32,   // 強調
};

// 統一されたgap
export const IconGap = {
  tight: 4,
  normal: 8,
  loose: 12,
};
```

---

## 10. フィードバック

### 良い点

- Alert.alertのi18n対応
- 適切なタイトル+メッセージ構成
- キャンセルボタンの配置が正しい

### 改善点

- iOS/Androidでの一貫性: ActionSheetIOSとAlert.alertの使い分け
- エラーメッセージのユーザーフレンドリー化

---

## 実装優先順位

### Phase 1: 最優先 (アクセシビリティ基盤)

1. **タッチターゲットサイズの統一**
   - すべてのボタン、リスト項目を44x44pt以上に
   - 対象: 設定ボタン、検索結果、メタデータボタン

2. **基本的なアクセシビリティ対応**
   - 主要コンポーネントに`accessibilityLabel`追加
   - `accessibilityRole`の指定
   - アイコンの`accessibilityElementsHidden`設定

3. **コントラスト比の改善**
   - `#999`, `#ccc`の使用箇所を見直し
   - WCAG AA (4.5:1) を達成

### Phase 2: 重要 (視覚的品質)

4. **ダークモード対応**
   - 統一カラーシステムの構築 (`lib/colors.ts`)
   - `useColorScheme`フックの導入
   - 全コンポーネントへの適用

5. **SafeAreaView統一**
   - ハードコードpadding値の除去
   - `useSafeAreaInsets`の導入

6. **フォーカス状態の視覚化**
   - TextInputのフォーカスボーダー
   - ボタンの押下状態

### Phase 3: 推奨 (品質向上)

7. **Dynamic Type対応**
   - `allowFontScaling`の適切な設定
   - フォントサイズスケーリング上限の設定

8. **アイコンサイズ統一**
   - デザインシステムトークンの作成
   - 全コンポーネントへの適用

9. **キーボード処理の統一**
   - KeyboardAvoidingViewの適用
   - returnKeyType, keyboardTypeの適切な設定

### Phase 4: 将来

10. **VoiceOverテスト**
    - 実機でのスクリーンリーダーテスト
    - ナビゲーション順序の確認

11. **iPad/タブレット対応**
    - レスポンシブレイアウトの実装
    - Split Viewへの対応

---

## 推奨: デザインシステムの構築

すべての改善を効率的に進めるため、統一されたデザインシステムの構築を推奨します。

```typescript
// lib/designSystem.ts

import { useColorScheme, PixelRatio } from 'react-native';

// スペーシング
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// タッチターゲット
export const TouchTarget = {
  minimum: 44,
  recommended: 48,
} as const;

// フォントサイズ (HIG準拠)
export const FontSize = {
  caption2: 11,
  caption1: 12,
  footnote: 13,
  subheadline: 15,
  body: 17,
  headline: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  largeTitle: 34,
} as const;

// アイコンサイズ
export const IconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

// カラーパレット
export const Colors = {
  light: {
    background: '#ffffff',
    surface: '#f2f2f7',
    text: '#000000',
    textSecondary: '#3c3c43',
    textTertiary: '#8e8e93',
    separator: '#c6c6c8',
    accent: '#007AFF',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
  },
  dark: {
    background: '#000000',
    surface: '#1c1c1e',
    text: '#ffffff',
    textSecondary: '#ebebf5',
    textTertiary: '#8e8e93',
    separator: '#38383a',
    accent: '#0A84FF',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
  },
} as const;

// テーマカラーフック
export const useThemeColors = () => {
  const colorScheme = useColorScheme();
  return Colors[colorScheme ?? 'light'];
};
```

---

## 参考リンク

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Expo Accessibility](https://docs.expo.dev/guides/accessibility/)
