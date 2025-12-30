import { useEffect, useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { getLocalDatabaseVersion, resetDatabase } from "../lib/database";
import { isWeatherEnabled, setWeatherEnabled } from "../lib/secrets";
import {
  configureGoogleSignIn,
  signInToGoogle,
  signOutFromGoogle,
  isSignedIn,
  refreshAccessToken,
} from "../lib/cloud-storage";
import { syncWithCloud } from "../lib/sync";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

export default function Settings() {
  const router = useRouter();
  const [dbVersion, setDbVersion] = useState<number | null>(null);
  const [weatherEnabled, setWeatherEnabledState] = useState(false);
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    getLocalDatabaseVersion().then(setDbVersion);
    loadWeatherEnabled();
    checkGoogleSignIn();
  }, []);

  const checkGoogleSignIn = useCallback(async () => {
    configureGoogleSignIn();
    const signedIn = isSignedIn();
    setGoogleSignedIn(signedIn);
    if (signedIn) {
      const user = GoogleSignin.getCurrentUser();
      setGoogleEmail(user?.user?.email ?? null);
      // Refresh token on app load
      await refreshAccessToken();
    }
  }, []);

  const loadWeatherEnabled = async () => {
    const enabled = await isWeatherEnabled();
    setWeatherEnabledState(enabled);
  };

  const handleWeatherToggle = async (value: boolean) => {
    setWeatherEnabledState(value);
    await setWeatherEnabled(value);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const token = await signInToGoogle();
      if (token) {
        setGoogleSignedIn(true);
        const user = GoogleSignin.getCurrentUser();
        setGoogleEmail(user?.user?.email ?? null);
        Alert.alert("成功", "Googleアカウントに接続しました");
      } else {
        Alert.alert("エラー", "サインインに失敗しました");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      Alert.alert("エラー", "サインインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    Alert.alert(
      "確認",
      "Googleアカウントとの接続を解除しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "解除",
          style: "destructive",
          onPress: async () => {
            await signOutFromGoogle();
            setGoogleSignedIn(false);
            setGoogleEmail(null);
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Refresh token before sync
      await refreshAccessToken();

      const result = await syncWithCloud();

      if (result.uploaded || result.imported > 0) {
        Alert.alert(
          "同期完了",
          `アップロード: ${result.uploaded ? "成功" : "なし"}\n` +
          `ダウンロード: ${result.downloaded}件\n` +
          `インポート: ${result.imported}件`
        );
      } else {
        Alert.alert("同期完了", "変更はありませんでした");
      }
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("エラー", "同期に失敗しました: " + String(error));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetDatabase = () => {
    Alert.alert(
      "データベースをリセット",
      "全ての日記データが削除されます。この操作は取り消せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "リセット",
          style: "destructive",
          onPress: async () => {
            await resetDatabase();
            const newVersion = await getLocalDatabaseVersion();
            setDbVersion(newVersion);
            Alert.alert("完了", "データベースをリセットしました");
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>天気</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>天気を取得する</Text>
          <Switch
            value={weatherEnabled}
            onValueChange={handleWeatherToggle}
          />
        </View>
        <Text style={styles.note}>
          日記の日付と位置情報から天気を自動記録します（Open-Meteo使用）
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>クラウド同期</Text>
        {googleSignedIn ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Googleアカウント</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {googleEmail ?? "接続済み"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.actionText}>今すぐ同期</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={handleGoogleSignOut}
            >
              <Text style={styles.rowLabel}>接続を解除</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.actionText}>Googleアカウントに接続</Text>
            )}
          </TouchableOpacity>
        )}
        <Text style={styles.note}>
          Google Driveを使って複数デバイス間で日記を同期します
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>デバッグ情報</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>データベースバージョン</Text>
          <Text style={styles.rowValue}>
            {dbVersion !== null ? `v${dbVersion}` : "読み込み中..."}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push("/debug-logs")}
        >
          <Text style={styles.rowLabel}>デバッグログ</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>データ管理</Text>
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={handleResetDatabase}
        >
          <Text style={styles.dangerText}>データベースをリセット</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 13,
    color: "#666",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
  },
  rowLabel: {
    fontSize: 17,
    color: "#000",
  },
  rowValue: {
    fontSize: 17,
    color: "#666",
  },
  note: {
    fontSize: 13,
    color: "#666",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
  },
  chevron: {
    fontSize: 20,
    color: "#c6c6c8",
  },
  actionRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  actionText: {
    fontSize: 17,
    color: "#007AFF",
  },
  dangerRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
    alignItems: "center",
  },
  dangerText: {
    fontSize: 17,
    color: "#FF3B30",
  },
});
