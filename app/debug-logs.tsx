import { useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { DebugLogEntry, getDebugLogs, clearDebugLogs } from "../lib/debug-log";

const formatLogForCopy = (log: DebugLogEntry): string => {
  let text = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
  if (log.details) {
    text += `\n${log.details}`;
  }
  return text;
};

export default function DebugLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [])
  );

  const loadLogs = async () => {
    const data = await getDebugLogs();
    setLogs(data);
  };

  const handleClear = () => {
    Alert.alert(t('common.confirm'), t('debugLogs.deleteConfirm'), [
      { text: t('common.cancel'), style: "cancel" },
      {
        text: t('common.delete'),
        style: "destructive",
        onPress: async () => {
          await clearDebugLogs();
          setLogs([]);
        },
      },
    ]);
  };

  const handleCopyAll = async () => {
    const text = logs.map(formatLogForCopy).join("\n\n");
    await Clipboard.setStringAsync(text);
    Alert.alert(t('debugLogs.copied'), t('debugLogs.copiedAll'));
  };

  const handleCopyLog = async (log: DebugLogEntry) => {
    const text = formatLogForCopy(log);
    await Clipboard.setStringAsync(text);
    Alert.alert(t('debugLogs.copied'), t('debugLogs.copiedOne'));
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLevelColor = (level: DebugLogEntry["level"]) => {
    switch (level) {
      case "error":
        return "#FF3B30";
      case "warn":
        return "#FF9500";
      case "info":
      default:
        return "#007AFF";
    }
  };

  const renderItem = ({ item }: { item: DebugLogEntry }) => (
    <TouchableOpacity style={styles.logItem} onPress={() => handleCopyLog(item)}>
      <View style={styles.logHeader}>
        <Text style={[styles.logLevel, { color: getLevelColor(item.level) }]}>
          {item.level.toUpperCase()}
        </Text>
        <Text style={styles.logTimestamp}>{formatTimestamp(item.timestamp)}</Text>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
      {item.details ? (
        <Text style={styles.logDetails}>{item.details}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {logs.length > 0 && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyAll}>
            <Text style={styles.copyButtonText}>{t('debugLogs.copyAll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>{t('debugLogs.deleteAll')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={logs}
        keyExtractor={(item, index) => `${item.timestamp}-${index}`}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('debugLogs.noLogs')}</Text>
        }
        contentContainerStyle={logs.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  buttonRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c6c6c8",
  },
  copyButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#c6c6c8",
  },
  copyButtonText: {
    color: "#007AFF",
    fontSize: 16,
  },
  clearButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#FF3B30",
    fontSize: 16,
  },
  logItem: {
    backgroundColor: "#fff",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c6c6c8",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: "600",
  },
  logTimestamp: {
    fontSize: 12,
    color: "#666",
  },
  logMessage: {
    fontSize: 14,
    color: "#000",
  },
  logDetails: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    fontFamily: "Courier",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
  },
});
