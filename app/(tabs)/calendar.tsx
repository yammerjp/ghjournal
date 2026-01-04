import { useCallback, useLayoutEffect, useState, useRef } from "react";
import { Text, View, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { CalendarList, DateData } from "react-native-calendars";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { getEntryDates, getEntryByDate } from "../../lib/entry";
import { useSync } from "../../contexts/SyncContext";
import { formatDate } from "../../lib/format";

interface MarkedDates {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
    customStyles?: {
      container?: object;
      text?: object;
    };
  };
}

export default function CalendarScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const { isSyncing, pullIfNeeded } = useSync();
  const today = formatDate(new Date());
  const calendarRef = useRef<any>(null);
  const isFirstMount = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadEntryDates();
      pullIfNeeded().then(() => {
        loadEntryDates();
      });
      // Scroll to current month only on first mount
      if (isFirstMount.current && calendarRef.current) {
        calendarRef.current.scrollToMonth(today);
        isFirstMount.current = false;
      }
    }, [pullIfNeeded, today])
  );

  const loadEntryDates = async () => {
    const dates = await getEntryDates();
    setEntryDates(new Set(dates));
  };

  const handleDayPress = async (day: DateData) => {
    const entry = await getEntryByDate(day.dateString);
    if (entry) {
      router.push(`/entries/${entry.id}`);
    }
  };

  // Convert entry dates to marked dates format
  const markedDates: MarkedDates = {};

  for (const date of entryDates) {
    markedDates[date] = {
      customStyles: {
        container: {
          backgroundColor: "#007AFF",
          borderRadius: 8,
        },
        text: {
          color: "#fff",
          fontWeight: "600",
        },
      },
    };
  }

  // Highlight today
  if (markedDates[today]) {
    // Today with entry: blue background with border
    markedDates[today] = {
      customStyles: {
        container: {
          backgroundColor: "#007AFF",
          borderRadius: 8,
          borderWidth: 2,
          borderColor: "#FF3B30",
        },
        text: {
          color: "#fff",
          fontWeight: "600",
        },
      },
    };
  } else {
    // Today without entry: light background
    markedDates[today] = {
      customStyles: {
        container: {
          backgroundColor: "#E3F2FD",
          borderRadius: 8,
        },
        text: {
          color: "#007AFF",
          fontWeight: "600",
        },
      },
    };
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('calendar.title')}</Text>
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

      <View style={styles.calendarContainer}>
        <CalendarList
          ref={calendarRef}
          current={today}
          onDayPress={handleDayPress}
          markedDates={markedDates}
          markingType="custom"
          pastScrollRange={24}
          futureScrollRange={12}
          showScrollIndicator={true}
          calendarHeight={350}
          staticHeader={true}
          theme={{
            backgroundColor: "#ffffff",
            calendarBackground: "#ffffff",
            textSectionTitleColor: "#666",
            selectedDayBackgroundColor: "#007AFF",
            selectedDayTextColor: "#007AFF",
            todayTextColor: "#007AFF",
            dayTextColor: "#333",
            textDisabledColor: "#ccc",
            dotColor: "#007AFF",
            selectedDotColor: "#007AFF",
            arrowColor: "#007AFF",
            monthTextColor: "#333",
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 14,
            textDayFontWeight: "400",
            textMonthFontWeight: "600",
            textDayHeaderFontWeight: "600",
          }}
        />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendBox} />
          <Text style={styles.legendText}>{t('calendar.daysWithEntries')}</Text>
        </View>
        <View style={[styles.legendItem, { marginLeft: 16 }]}>
          <View style={styles.legendTodayBox} />
          <Text style={styles.legendText}>{t('calendar.today')}</Text>
        </View>
      </View>

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
  settingsButton: {
    padding: 4,
  },
  calendarContainer: {
    flex: 1,
  },
  legend: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginRight: 6,
  },
  legendTodayBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: "#E3F2FD",
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#666",
  },
  addButton: {
    position: "absolute",
    bottom: 90,
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
