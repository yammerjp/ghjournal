import { useCallback, useLayoutEffect, useState, useMemo } from "react";
import { Text, View, SectionList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Diary, getDiaries } from "../lib/diary";

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
  data: Diary[];
}

export default function Index() {
  const router = useRouter();
  const navigation = useNavigation();
  const [diaries, setDiaries] = useState<Diary[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      getDiaries().then(setDiaries);
    }, [])
  );

  // Group diaries by year-month
  const sections = useMemo((): Section[] => {
    const grouped = new Map<string, Diary[]>();

    for (const diary of diaries) {
      const yearMonth = diary.date.slice(0, 7); // "2025-12"
      const existing = grouped.get(yearMonth) || [];
      existing.push(diary);
      grouped.set(yearMonth, existing);
    }

    return Array.from(grouped.entries()).map(([yearMonth, data]) => ({
      title: formatYearMonth(yearMonth + "-01"),
      data,
    }));
  }, [diaries]);

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Diary }) => {
    const day = getDay(item.date);
    const weekday = getWeekday(item.date);

    return (
      <TouchableOpacity
        style={styles.diaryItem}
        onPress={() => router.push(`/diaries/${item.id}`)}
      >
        <View style={styles.dateColumn}>
          <Text style={styles.weekday}>{weekday}</Text>
          <Text style={styles.day}>{day}</Text>
        </View>
        <View style={styles.contentColumn}>
          {item.title ? (
            <Text style={styles.diaryTitle} numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          <Text style={styles.diaryContent} numberOfLines={2}>
            {item.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>日記</Text>
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
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/diaries/new")}
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
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
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
  diaryItem: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  dateColumn: {
    width: 40,
    alignItems: "center",
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
  contentColumn: {
    flex: 1,
    justifyContent: "center",
  },
  diaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  diaryContent: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
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
