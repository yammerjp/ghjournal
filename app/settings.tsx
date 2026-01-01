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
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
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
  fetchAccessibleRepositories,
  GitHubConfig,
  GitHubRepository,
} from "../lib/github-auth";
import { syncEntries, SyncResult } from "../lib/github-sync";

const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "";
const GITHUB_APP_NAME = process.env.EXPO_PUBLIC_GITHUB_APP_NAME ?? "";
const GITHUB_APP_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;
const GITHUB_NEW_REPO_URL = "https://github.com/new?name=journal&visibility=private&owner=@me&description=ghjournal%E3%81%AE%E6%97%A5%E8%A8%98%E3%83%87%E3%83%BC%E3%82%BF";

type AuthState =
  | { type: "idle" }
  | { type: "requesting" }
  | { type: "waiting_for_user"; userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresAt: number }
  | { type: "polling" }
  | { type: "success" }
  | { type: "error"; message: string };

export default function Settings() {
  const router = useRouter();
  const [dbVersion, setDbVersion] = useState<number | null>(null);
  const [weatherEnabled, setWeatherEnabledState] = useState(false);
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [authState, setAuthState] = useState<AuthState>({ type: "idle" });
  const [showRepoSelect, setShowRepoSelect] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<GitHubRepository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [isCodeCopied, setIsCodeCopied] = useState(false);

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
    setIsCodeCopied(false);

    try {
      const response = await requestDeviceCode(GITHUB_CLIENT_ID);

      setAuthState({
        type: "waiting_for_user",
        userCode: response.user_code,
        verificationUri: response.verification_uri,
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

  const copyUserCode = async () => {
    if (authState.type === "waiting_for_user") {
      await Clipboard.setStringAsync(authState.userCode);
      setIsCodeCopied(true);
    }
  };

  const openVerificationUrl = async () => {
    if (authState.type === "waiting_for_user") {
      startPolling();
      await WebBrowser.openAuthSessionAsync(authState.verificationUri, "ghjournal://");
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
          await setAccessToken(response.access_token, response.expires_in, response.refresh_token);
          setAuthState({ type: "success" });
          // 認証成功したらブラウザを閉じる（失敗しても問題なし）
          try {
            WebBrowser.dismissAuthSession();
          } catch {
            // ユーザーが既にブラウザを閉じていた場合は無視
          }
          // リポジトリ一覧を取得
          setIsLoadingRepos(true);
          setShowRepoSelect(true);
          try {
            const repos = await fetchAccessibleRepositories();
            setAvailableRepos(repos);
          } catch (error) {
            Alert.alert("エラー", "リポジトリ一覧の取得に失敗しました");
          } finally {
            setIsLoadingRepos(false);
          }
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

  const handleSelectRepository = async (repo: GitHubRepository) => {
    await setRepository(repo.full_name);
    setShowRepoSelect(false);
    setAvailableRepos([]);
    setAuthState({ type: "idle" });
    await loadData();
  };

  const reloadRepositories = async () => {
    setIsLoadingRepos(true);
    try {
      const repos = await fetchAccessibleRepositories();
      setAvailableRepos(repos);
    } catch (error) {
      Alert.alert("エラー", "リポジトリ一覧の取得に失敗しました");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const openInstallPage = async () => {
    // 外部ブラウザで開く（ログイン状態を維持するため）
    await Linking.openURL(GITHUB_APP_INSTALL_URL);
  };

  const openNewRepoPage = async () => {
    await Linking.openURL(GITHUB_NEW_REPO_URL);
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

  const cancelAuth = async () => {
    setAuthState({ type: "idle" });
    setShowRepoSelect(false);
    setAvailableRepos([]);
    // 認証成功後にキャンセルした場合はトークンもクリア
    await clearAccessToken();
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
      if (pushResult.deleted > 0) messages.push(`${pushResult.deleted}件リモート削除`);
      if (pullResult.deleted > 0) messages.push(`${pullResult.deleted}件ローカル削除`);

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
            style={[styles.actionRow, isSyncing && styles.disabledButton]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <View style={styles.syncingRow}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={[styles.actionText, { marginLeft: 8 }]}>同期中...</Text>
              </View>
            ) : (
              <Text style={styles.actionText}>今すぐ同期</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerRow} onPress={handleDisconnect}>
            <Text style={styles.dangerText}>連携を解除</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Repository selection after successful auth
    if (showRepoSelect) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GitHub同期</Text>
          {isLoadingRepos ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" />
              <Text style={[styles.rowLabel, { marginLeft: 12 }]}>読み込み中...</Text>
            </View>
          ) : availableRepos.length === 0 ? (
            <>
              <Text style={styles.note}>
                同期用のリポジトリが必要です。まだない場合は作成してから、アクセスを許可してください。
              </Text>
              <TouchableOpacity style={styles.actionRow} onPress={openNewRepoPage}>
                <Text style={styles.actionText}>新しいリポジトリを作成</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionRow} onPress={openInstallPage}>
                <Text style={styles.actionText}>リポジトリへのアクセスを許可</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionRow} onPress={reloadRepositories}>
                <Text style={styles.actionText}>リポジトリ一覧を更新</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>リポジトリを選択</Text>
              </View>
              {availableRepos.map((repo) => (
                <TouchableOpacity
                  key={repo.id}
                  style={styles.repoRow}
                  onPress={() => handleSelectRepository(repo)}
                >
                  <View>
                    <Text style={styles.repoName}>{repo.full_name}</Text>
                    <Text style={styles.repoMeta}>
                      {repo.private ? "プライベート" : "パブリック"}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <TouchableOpacity style={styles.secondaryRow} onPress={cancelAuth}>
            <Text style={styles.secondaryText}>キャンセル</Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.secondaryRow} onPress={cancelAuth}>
            <Text style={styles.secondaryText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authState.type === "waiting_for_user") {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GitHub同期</Text>
          <TouchableOpacity style={styles.codeBox} onPress={copyUserCode}>
            <Text style={styles.codeLabel}>
              {isCodeCopied ? "✓ コピーしました" : "認証コード（タップでコピー）"}
            </Text>
            <Text style={styles.codeValue}>{authState.userCode}</Text>
          </TouchableOpacity>
          {isCodeCopied ? (
            <>
              <TouchableOpacity style={styles.actionRow} onPress={openVerificationUrl}>
                <Text style={styles.actionText}>GitHubに接続</Text>
              </TouchableOpacity>
              <Text style={styles.note}>
                GitHubで認証コードを貼り付けてください。完了後、左上の「Done」をタップしてアプリに戻ってください。
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.actionRow} onPress={copyUserCode}>
                <Text style={styles.actionText}>コードをコピー</Text>
              </TouchableOpacity>
              <Text style={styles.note}>
                まず認証コードをコピーしてください
              </Text>
            </>
          )}
          <TouchableOpacity style={styles.secondaryRow} onPress={cancelAuth}>
            <Text style={styles.secondaryText}>キャンセル</Text>
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
          <TouchableOpacity style={styles.actionRow} onPress={startGitHubAuth}>
            <Text style={styles.actionText}>再試行</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Not connected (idle)
    return (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>GitHub同期</Text>
        <TouchableOpacity style={styles.actionRow} onPress={startGitHubAuth}>
          <Text style={styles.actionText}>GitHubに接続</Text>
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
  actionRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
    alignItems: "center",
  },
  actionText: {
    fontSize: 17,
    color: "#007AFF",
  },
  secondaryRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 17,
    color: "#666",
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
  loadingRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
    alignItems: "center",
  },
  repoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
  },
  repoName: {
    fontSize: 17,
    color: "#000",
  },
  repoMeta: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
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
