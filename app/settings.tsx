import { useEffect, useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { getDatabaseVersion, resetDatabase } from "../lib/database";
import { isWeatherEnabled, setWeatherEnabled } from "../lib/secrets";
import {
  getGitHubConfig,
  requestDeviceCode,
  pollForAccessToken,
  setAccessToken,
  clearAccessToken,
  setRepository,
  clearRepository,
  isAccessTokenSuccess,
  GitHubConfig,
} from "../lib/github-auth";
import { syncEntries, SyncResult } from "../lib/github-sync";

const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "";

type AuthState =
  | { type: "idle" }
  | { type: "requesting" }
  | { type: "waiting_for_user"; userCode: string; verificationUri: string; verificationUriComplete?: string; deviceCode: string; interval: number; expiresAt: number }
  | { type: "polling" }
  | { type: "success" }
  | { type: "error"; message: string };

export default function Settings() {
  const router = useRouter();
  const [dbVersion, setDbVersion] = useState<number | null>(null);
  const [weatherEnabled, setWeatherEnabledState] = useState(false);
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [authState, setAuthState] = useState<AuthState>({ type: "idle" });
  const [repositoryInput, setRepositoryInput] = useState("");
  const [showRepoInput, setShowRepoInput] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const loadData = useCallback(async () => {
    const [version, enabled, config] = await Promise.all([
      getDatabaseVersion(),
      isWeatherEnabled(),
      getGitHubConfig(),
    ]);
    setDbVersion(version);
    setWeatherEnabledState(enabled);
    setGithubConfig(config);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWeatherToggle = async (value: boolean) => {
    setWeatherEnabledState(value);
    await setWeatherEnabled(value);
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
            await loadData();
            Alert.alert("完了", "データベースをリセットしました");
          },
        },
      ]
    );
  };

  const startGitHubAuth = async () => {
    setAuthState({ type: "requesting" });

    try {
      const response = await requestDeviceCode(GITHUB_CLIENT_ID);

      setAuthState({
        type: "waiting_for_user",
        userCode: response.user_code,
        verificationUri: response.verification_uri,
        verificationUriComplete: response.verification_uri_complete,
        deviceCode: response.device_code,
        interval: response.interval,
        expiresAt: Date.now() + response.expires_in * 1000,
      });
    } catch (error) {
      setAuthState({
        type: "error",
        message: error instanceof Error ? error.message : "認証に失敗しました",
      });
    }
  };

  const openVerificationUrl = async () => {
    if (authState.type === "waiting_for_user") {
      // verificationUriComplete があればそれを使う（user_code入力不要）
      const url = authState.verificationUriComplete || authState.verificationUri;
      await Linking.openURL(url);
      startPolling();
    }
  };

  const copyUserCode = async () => {
    if (authState.type === "waiting_for_user") {
      await Clipboard.setStringAsync(authState.userCode);
      Alert.alert("コピーしました", `認証コード: ${authState.userCode}`);
    }
  };

  const startPolling = async () => {
    if (authState.type !== "waiting_for_user") return;

    const { deviceCode, interval, expiresAt } = authState;
    setAuthState({ type: "polling" });

    const poll = async (): Promise<void> => {
      if (Date.now() > expiresAt) {
        setAuthState({ type: "error", message: "認証がタイムアウトしました" });
        return;
      }

      try {
        const response = await pollForAccessToken(GITHUB_CLIENT_ID, deviceCode);

        if (isAccessTokenSuccess(response)) {
          await setAccessToken(response.access_token);
          setAuthState({ type: "success" });
          setShowRepoInput(true);
          return;
        }

        if (response.error === "authorization_pending") {
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
          return poll();
        }

        if (response.error === "slow_down") {
          const newInterval = response.interval || interval + 5;
          await new Promise((resolve) => setTimeout(resolve, newInterval * 1000));
          return poll();
        }

        if (response.error === "expired_token") {
          setAuthState({ type: "error", message: "認証がタイムアウトしました" });
          return;
        }

        if (response.error === "access_denied") {
          setAuthState({ type: "error", message: "認証がキャンセルされました" });
          return;
        }

        setAuthState({ type: "error", message: response.error_description || "認証に失敗しました" });
      } catch (error) {
        setAuthState({
          type: "error",
          message: error instanceof Error ? error.message : "認証に失敗しました",
        });
      }
    };

    await poll();
  };

  const handleSaveRepository = async () => {
    if (!repositoryInput.trim()) {
      Alert.alert("エラー", "リポジトリを入力してください（例: owner/repo）");
      return;
    }

    const repoPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (!repoPattern.test(repositoryInput.trim())) {
      Alert.alert("エラー", "リポジトリの形式が正しくありません（例: owner/repo）");
      return;
    }

    await setRepository(repositoryInput.trim());
    setShowRepoInput(false);
    setRepositoryInput("");
    setAuthState({ type: "idle" });
    await loadData();
  };

  const handleDisconnect = () => {
    Alert.alert(
      "GitHub連携を解除",
      "GitHubとの連携を解除しますか？ローカルのデータは削除されません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "解除",
          style: "destructive",
          onPress: async () => {
            await clearAccessToken();
            await clearRepository();
            setAuthState({ type: "idle" });
            await loadData();
          },
        },
      ]
    );
  };

  const cancelAuth = () => {
    setAuthState({ type: "idle" });
    setShowRepoInput(false);
    setRepositoryInput("");
  };

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      const result = await syncEntries();
      setLastSyncResult(result);

      const { pullResult, pushResult } = result;
      const messages: string[] = [];

      if (pullResult.created > 0) messages.push(`${pullResult.created}件取得`);
      if (pullResult.updated > 0) messages.push(`${pullResult.updated}件更新`);
      if (pushResult.pushed > 0) messages.push(`${pushResult.pushed}件送信`);
      if (pullResult.deleted > 0) messages.push(`${pullResult.deleted}件削除`);

      if (pullResult.conflicts > 0) {
        Alert.alert(
          "衝突を検知",
          `${pullResult.conflicts}件の日記で衝突が発生しました（${pullResult.conflictDates.join(", ")}）。\n\n次回の同期で上書きされます。`,
          [{ text: "OK" }]
        );
      } else if (messages.length > 0) {
        Alert.alert("同期完了", messages.join("、"));
      } else {
        Alert.alert("同期完了", "変更はありませんでした");
      }

      if (!pullResult.success || !pushResult.success) {
        const errors = [...pullResult.errors, ...pushResult.errors];
        if (errors.length > 0) {
          Alert.alert("エラー", errors.join("\n"));
        }
      }
    } catch (error) {
      Alert.alert("同期エラー", error instanceof Error ? error.message : "同期に失敗しました");
    } finally {
      setIsSyncing(false);
    }
  };

  const renderGitHubSection = () => {
    // Connected state
    if (githubConfig?.hasToken && githubConfig?.repository) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GitHub同期</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>リポジトリ</Text>
            <Text style={styles.rowValue}>{githubConfig.repository}</Text>
          </View>
          {githubConfig.connectedAt && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>接続日時</Text>
              <Text style={styles.rowValue}>
                {new Date(githubConfig.connectedAt).toLocaleString("ja-JP")}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.linkButton, isSyncing && styles.disabledButton]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <View style={styles.syncingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.linkButtonText, { marginLeft: 8 }]}>同期中...</Text>
              </View>
            ) : (
              <Text style={styles.linkButtonText}>今すぐ同期</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerRow} onPress={handleDisconnect}>
            <Text style={styles.dangerText}>連携を解除</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Repository input after successful auth
    if (showRepoInput) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GitHub同期</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>認証成功</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="owner/repo"
              value={repositoryInput}
              onChangeText={setRepositoryInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelAuth}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveRepository}>
              <Text style={styles.primaryButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>
            同期に使用するプライベートリポジトリを入力してください
          </Text>
        </View>
      );
    }

    // Auth states
    if (authState.type === "requesting" || authState.type === "polling") {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GitHub同期</Text>
          <View style={styles.row}>
            <ActivityIndicator size="small" />
            <Text style={[styles.rowLabel, { marginLeft: 12 }]}>
              {authState.type === "requesting" ? "準備中..." : "認証を待っています..."}
            </Text>
          </View>
          <TouchableOpacity style={styles.dangerRow} onPress={cancelAuth}>
            <Text style={styles.dangerText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authState.type === "waiting_for_user") {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GitHub同期</Text>
          <TouchableOpacity style={styles.codeBox} onPress={copyUserCode}>
            <Text style={styles.codeLabel}>認証コード（タップでコピー）</Text>
            <Text style={styles.codeValue}>{authState.userCode}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={openVerificationUrl}>
            <Text style={styles.linkButtonText}>GitHubで認証</Text>
          </TouchableOpacity>
          <Text style={styles.note}>
            {authState.verificationUriComplete
              ? "上のボタンをタップしてGitHubを開いてください"
              : "上のボタンをタップしてGitHubを開き、認証コードを入力してください"}
          </Text>
          <TouchableOpacity style={styles.dangerRow} onPress={cancelAuth}>
            <Text style={styles.dangerText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authState.type === "error") {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GitHub同期</Text>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: "#FF3B30" }]}>
              エラー: {authState.message}
            </Text>
          </View>
          <TouchableOpacity style={styles.linkButton} onPress={startGitHubAuth}>
            <Text style={styles.linkButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Not connected (idle)
    return (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>GitHub同期</Text>
        <TouchableOpacity style={styles.linkButton} onPress={startGitHubAuth}>
          <Text style={styles.linkButtonText}>GitHubに接続</Text>
        </TouchableOpacity>
        <Text style={styles.note}>
          GitHubプライベートリポジトリを使って複数デバイス間で日記を同期します
        </Text>
      </View>
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

      {renderGitHubSection()}

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
  linkButton: {
    backgroundColor: "#007AFF",
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  linkButtonText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "600",
  },
  codeBox: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  codeLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Courier",
    letterSpacing: 4,
    color: "#000",
  },
  inputRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
  },
  textInput: {
    fontSize: 17,
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f2f2f7",
    borderWidth: 1,
    borderColor: "#c6c6c8",
  },
  cancelButtonText: {
    fontSize: 17,
    color: "#000",
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#007AFF",
  },
  primaryButtonText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  syncingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
