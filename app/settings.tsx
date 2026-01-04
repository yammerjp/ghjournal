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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      t('settings.data.reset'),
      t('settings.data.resetConfirm'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('common.delete'),
          style: "destructive",
          onPress: async () => {
            await resetDatabase();
            await loadData();
            Alert.alert(t('common.done'), t('settings.data.resetComplete'));
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
        message: error instanceof Error ? error.message : t('settings.auth.failed'),
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
        setAuthState({ type: "error", message: t('settings.auth.timeout') });
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
            Alert.alert(t('common.error'), t('settings.github.fetchRepositoriesError'));
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
          setAuthState({ type: "error", message: t('settings.auth.timeout') });
          return;
        }

        if (response.error === "access_denied") {
          setAuthState({ type: "error", message: t('settings.auth.cancelled') });
          return;
        }

        setAuthState({ type: "error", message: response.error_description || t('settings.auth.failed') });
      } catch (error) {
        setAuthState({
          type: "error",
          message: error instanceof Error ? error.message : t('settings.auth.failed'),
        });
      }
    };

    await poll();
  };

  const handleSelectRepository = async (repo: GitHubRepository) => {
    await setRepository(repo.full_name, repo.private);
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
      Alert.alert(t('common.error'), t('settings.github.fetchRepositoriesError'));
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
      t('settings.github.disconnect'),
      t('settings.github.disconnectConfirm'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('settings.github.disconnect'),
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

      if (pullResult.created > 0) messages.push(t('settings.github.syncResult.fetched', { count: pullResult.created }));
      if (pullResult.updated > 0) messages.push(t('settings.github.syncResult.updated', { count: pullResult.updated }));
      if (pushResult.pushed > 0) messages.push(t('settings.github.syncResult.pushed', { count: pushResult.pushed }));
      if (pushResult.deleted > 0) messages.push(t('settings.github.syncResult.deletedRemote', { count: pushResult.deleted }));
      if (pullResult.deleted > 0) messages.push(t('settings.github.syncResult.deletedLocal', { count: pullResult.deleted }));

      if (pullResult.conflicts > 0) {
        Alert.alert(
          t('settings.github.conflictDetected'),
          t('settings.github.conflictMessage', { count: pullResult.conflicts, dates: pullResult.conflictDates.join(", ") }),
          [{ text: "OK" }]
        );
      } else if (messages.length > 0) {
        Alert.alert(t('settings.github.syncComplete'), messages.join(", "));
      } else {
        Alert.alert(t('settings.github.syncComplete'), t('settings.github.syncNoChanges'));
      }

      if (!pullResult.success || !pushResult.success) {
        const errors = [...pullResult.errors, ...pushResult.errors];
        if (errors.length > 0) {
          Alert.alert(t('common.error'), errors.join("\n"));
        }
      }
    } catch (error) {
      Alert.alert(t('settings.github.syncError'), error instanceof Error ? error.message : t('settings.github.syncError'));
    } finally {
      setIsSyncing(false);
    }
  };

  const renderGitHubSection = () => {
    // Connected state
    if (githubConfig?.hasToken && githubConfig?.repository) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.github.title')}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.github.repository')}</Text>
            <Text style={styles.rowValue}>{githubConfig.repository}</Text>
          </View>
          {githubConfig.connectedAt && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('settings.github.connectedAt')}</Text>
              <Text style={styles.rowValue}>
                {new Date(githubConfig.connectedAt).toLocaleString()}
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
                <Text style={[styles.actionText, { marginLeft: 8 }]}>{t('settings.github.syncing')}</Text>
              </View>
            ) : (
              <Text style={styles.actionText}>{t('settings.github.syncNow')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerRow} onPress={handleDisconnect}>
            <Text style={styles.dangerText}>{t('settings.github.disconnect')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Repository selection after successful auth
    if (showRepoSelect) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.github.title')}</Text>
          {isLoadingRepos ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" />
              <Text style={[styles.rowLabel, { marginLeft: 12 }]}>{t('common.loading')}</Text>
            </View>
          ) : availableRepos.length === 0 ? (
            <>
              <Text style={styles.note}>
                {t('settings.github.noRepositories')}
              </Text>
              <TouchableOpacity style={styles.actionRow} onPress={openNewRepoPage}>
                <Text style={styles.actionText}>{t('settings.github.createRepository')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionRow} onPress={openInstallPage}>
                <Text style={styles.actionText}>{t('settings.github.allowAccess')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionRow} onPress={reloadRepositories}>
                <Text style={styles.actionText}>{t('settings.github.refreshRepositories')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('settings.github.selectRepository')}</Text>
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
                      {repo.private ? t('settings.github.private') : t('settings.github.public')}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <TouchableOpacity style={styles.secondaryRow} onPress={cancelAuth}>
            <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Auth states
    if (authState.type === "requesting" || authState.type === "polling") {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.github.title')}</Text>
          <View style={styles.row}>
            <ActivityIndicator size="small" />
            <Text style={[styles.rowLabel, { marginLeft: 12 }]}>
              {authState.type === "requesting" ? t('settings.auth.preparing') : t('settings.auth.waiting')}
            </Text>
          </View>
          <TouchableOpacity style={styles.secondaryRow} onPress={cancelAuth}>
            <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authState.type === "waiting_for_user") {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.github.title')}</Text>
          <TouchableOpacity style={styles.codeBox} onPress={copyUserCode}>
            <Text style={styles.codeLabel}>
              {isCodeCopied ? t('settings.auth.codeCopied') : t('settings.auth.copyCode')}
            </Text>
            <Text style={styles.codeValue}>{authState.userCode}</Text>
          </TouchableOpacity>
          {isCodeCopied ? (
            <>
              <TouchableOpacity style={styles.actionRow} onPress={openVerificationUrl}>
                <Text style={styles.actionText}>{t('settings.auth.openGitHub')}</Text>
              </TouchableOpacity>
              <Text style={styles.note}>
                {t('settings.auth.instruction')}
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.actionRow} onPress={copyUserCode}>
                <Text style={styles.actionText}>{t('settings.auth.copyCodeButton')}</Text>
              </TouchableOpacity>
              <Text style={styles.note}>
                {t('settings.auth.instructionCopy')}
              </Text>
            </>
          )}
          <TouchableOpacity style={styles.secondaryRow} onPress={cancelAuth}>
            <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authState.type === "error") {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.github.title')}</Text>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: "#FF3B30" }]}>
              {t('common.error')}: {authState.message}
            </Text>
          </View>
          <TouchableOpacity style={styles.actionRow} onPress={startGitHubAuth}>
            <Text style={styles.actionText}>{t('settings.auth.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Not connected (idle)
    return (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('settings.github.title')}</Text>
        <TouchableOpacity style={styles.actionRow} onPress={startGitHubAuth}>
          <Text style={styles.actionText}>{t('settings.github.connect')}</Text>
        </TouchableOpacity>
        <Text style={styles.note}>
          {t('settings.github.description')}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('settings.weather.title')}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.weather.enable')}</Text>
          <Switch
            value={weatherEnabled}
            onValueChange={handleWeatherToggle}
          />
        </View>
        <Text style={styles.note}>
          {t('settings.weather.description')}
        </Text>
        <Text style={styles.attributionRow}>
          <Text style={styles.attributionLabel}>Weather data by </Text>
          <Text
            style={styles.attributionLink}
            onPress={() => Linking.openURL("https://open-meteo.com/")}
          >
            Open-Meteo.com
          </Text>
        </Text>
      </View>

      {renderGitHubSection()}

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('settings.debug.title')}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.debug.databaseVersion')}</Text>
          <Text style={styles.rowValue}>
            {dbVersion !== null ? `v${dbVersion}` : t('common.loading')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push("/debug-logs")}
        >
          <Text style={styles.rowLabel}>{t('settings.debug.logs')}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('settings.data.title')}</Text>
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={handleResetDatabase}
        >
          <Text style={styles.dangerText}>{t('settings.data.reset')}</Text>
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
  attributionRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    fontSize: 12,
  },
  attributionLabel: {
    color: "#666",
  },
  attributionLink: {
    color: "#007AFF",
    textDecorationLine: "underline",
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
