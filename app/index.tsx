import { useCallback, useLayoutEffect, useState, useMemo } from "react";
import { Text, View, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Entry, getEntries } from "../lib/entry";
import { useSync } from "../contexts/SyncContext";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatYearMonth = (dateStr: string): string => {
  const [year, month] = dateStr.split("-");
  return `${year}年${parseInt(month, 10)}月`;
};

const getDay = (dateStr: string): number => {
  return parseInt(dateStr.split("-")[2], 10);
};

const getWeekday = (dateStr: string): string => {
  const date = parseDate(dateStr);
  return WEEKDAYS[date.getDay()];
};

interface Section {
  title: string;
  data: Entry[];
}

export default function Index() {
  const router = useRouter();
  const navigation = useNavigation();
  const [entries, setEntries] = useState<Entry[]>([]);
  const { isSyncing, pullIfNeeded, sync, isConnected } = useSync();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      getEntries().then(setEntries);
      // 画面フォーカス時に同期（条件を満たせば）
      pullIfNeeded().then(() => {
        // 同期後に再取得
        getEntries().then(setEntries);
      });
    }, [pullIfNeeded])
  );

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await sync();
      await getEntries().then(setEntries);
    } finally {
      setIsRefreshing(false);
    }
  }, [sync]);

  // Group entries by year-month
  const sections = useMemo((): Section[] => {
    const grouped = new Map<string, Entry[]>();

    for (const entry of entries) {
      const yearMonth = entry.date.slice(0, 7); // "2025-12"
      const existing = grouped.get(yearMonth) || [];
      existing.push(entry);
      grouped.set(yearMonth, existing);
    }

    return Array.from(grouped.entries()).map(([yearMonth, data]) => ({
      title: formatYearMonth(yearMonth + "-01"),
      data,
    }));
  }, [entries]);

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Entry }) => {
    const day = getDay(item.date);
    const weekday = getWeekday(item.date);

    const metaItems: string[] = [];
    if (item.location_city) {
      metaItems.push(item.location_city);
    }
    if (item.weather_description) {
      let weatherText = item.weather_description;
      if (item.weather_temperature_min != null && item.weather_temperature_max != null) {
        weatherText += ` ${item.weather_temperature_min}〜${item.weather_temperature_max}°`;
      }
      metaItems.push(weatherText);
    }

    const isUnsynced = item.sync_status === 'uncommitted';

    return (
      <TouchableOpacity
        style={styles.entryItem}
        onPress={() => router.push(`/entries/${item.id}`)}
      >
        <View style={styles.dateColumn}>
          <Text style={styles.weekday}>{weekday}</Text>
          <Text style={styles.day}>{day}</Text>
          {isUnsynced && isConnected && (
            <View style={styles.unsyncedDot} />
          )}
        </View>
        <View style={styles.contentColumn}>
          {item.title ? (
            <Text style={styles.entryTitle} numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          <Text style={styles.entryContent} numberOfLines={2}>
            {item.content}
          </Text>
          {metaItems.length > 0 && (
            <Text style={styles.entryMeta} numberOfLines={1}>
              {metaItems.join(" · ")}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>ghjournal</Text>
          {isSyncing && (
            <ActivityIndicator size="small" color="#007AFF" style={styles.syncIndicator} />
          )}
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push("/settings")}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
        ListEmptyComponent={
          <Text style={styles.emptyText}>日記がありません</Text>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/entries/new")}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  syncIndicator: {
    marginLeft: 8,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  entryItem: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  dateColumn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  weekday: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  day: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  unsyncedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF9500",
    marginTop: 4,
  },
  contentColumn: {
    flex: 1,
    justifyContent: "center",
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  entryContent: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  entryMeta: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    color: "#999",
  },
  settingsButton: {
    padding: 4,
  },
  addButton: {
    position: "absolute",
    bottom: 32,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
