import { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { getDatabaseVersion } from "../lib/database";
import { isWeatherEnabled, setWeatherEnabled } from "../lib/secrets";

export default function Settings() {
  const router = useRouter();
  const [dbVersion, setDbVersion] = useState<number | null>(null);
  const [weatherEnabled, setWeatherEnabledState] = useState(false);

  useEffect(() => {
    getDatabaseVersion().then(setDbVersion);
    loadWeatherEnabled();
  }, []);

  const loadWeatherEnabled = async () => {
    const enabled = await isWeatherEnabled();
    setWeatherEnabledState(enabled);
  };

  const handleWeatherToggle = async (value: boolean) => {
    setWeatherEnabledState(value);
    await setWeatherEnabled(value);
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
});
