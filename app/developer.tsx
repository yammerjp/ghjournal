import { useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getDatabaseVersion } from "../lib/database";

export default function Developer() {
  const { t } = useTranslation();
  const router = useRouter();
  const [dbVersion, setDbVersion] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const version = await getDatabaseVersion();
    setDbVersion(version);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.developer.databaseVersion')}</Text>
          <Text style={styles.rowValue}>
            {dbVersion !== null ? `v${dbVersion}` : t('common.loading')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push("/debug-logs")}
        >
          <Text style={styles.rowLabel}>{t('settings.developer.logs')}</Text>
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
  rowLabel: {
    fontSize: 17,
    color: "#000",
  },
  rowValue: {
    fontSize: 17,
    color: "#666",
  },
  chevron: {
    fontSize: 20,
    color: "#c7c7cc",
  },
});
