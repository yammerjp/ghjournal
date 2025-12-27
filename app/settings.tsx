import { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { getDatabaseVersion } from "../lib/database";
import {
  getOpenWeatherApiKey,
  setOpenWeatherApiKey,
  deleteOpenWeatherApiKey,
  isWeatherEnabled,
  setWeatherEnabled,
} from "../lib/secrets";

export default function Settings() {
  const router = useRouter();
  const [dbVersion, setDbVersion] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [weatherEnabled, setWeatherEnabledState] = useState(false);

  useEffect(() => {
    getDatabaseVersion().then(setDbVersion);
    loadApiKey();
    loadWeatherEnabled();
  }, []);

  const loadWeatherEnabled = async () => {
    const enabled = await isWeatherEnabled();
    setWeatherEnabledState(enabled);
  };

  const handleWeatherToggle = async (value: boolean) => {
    if (value && !hasApiKey) {
      Alert.alert("APIキーが必要", "天気機能を使用するにはAPIキーを設定してください");
      return;
    }
    setWeatherEnabledState(value);
    await setWeatherEnabled(value);
  };

  const loadApiKey = async () => {
    const key = await getOpenWeatherApiKey();
    if (key) {
      setHasApiKey(true);
      setApiKey(key);
    }
  };

  const handleSaveApiKey = async () => {
    if (apiKey.trim()) {
      await setOpenWeatherApiKey(apiKey.trim());
      setHasApiKey(true);
      setIsEditing(false);
      Alert.alert("保存完了", "APIキーを保存しました");
    }
  };

  const handleDeleteApiKey = () => {
    Alert.alert("確認", "APIキーを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          await deleteOpenWeatherApiKey();
          setApiKey("");
          setHasApiKey(false);
          setIsEditing(false);
        },
      },
    ]);
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>OpenWeather API</Text>
        <View style={styles.apiKeyContainer}>
          <Text style={styles.rowLabel}>APIキー</Text>
          {isEditing ? (
            <TextInput
              style={styles.apiKeyInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="APIキーを入力"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          ) : (
            <Text style={styles.rowValue}>
              {hasApiKey ? "••••••••" : "未設定"}
            </Text>
          )}
        </View>
        <View style={styles.buttonRow}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditing(false);
                  loadApiKey();
                }}
              >
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveApiKey}
              >
                <Text style={styles.saveButtonText}>保存</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editButtonText}>
                  {hasApiKey ? "変更" : "設定"}
                </Text>
              </TouchableOpacity>
              {hasApiKey && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteApiKey}
                >
                  <Text style={styles.deleteButtonText}>削除</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
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
  apiKeyContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
  },
  apiKeyInput: {
    flex: 1,
    fontSize: 17,
    textAlign: "right",
    marginLeft: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#c6c6c8",
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#007AFF",
    borderRadius: 6,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 15,
    fontWeight: "500",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#34C759",
    borderRadius: 6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#c6c6c8",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "500",
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
});
