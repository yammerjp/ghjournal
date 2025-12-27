import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Location, Weather, getDiary, updateDiary, deleteDiary, createDiary } from "../lib/diary";
import { getCurrentLocation } from "../lib/location";
import { getWeather } from "../lib/weather";
import LocationPickerModal from "./LocationPickerModal";
import DatePickerModal from "./DatePickerModal";

interface DiaryEditorProps {
  diaryId: string | null;
}

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDateShort = (d: Date): string => {
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const generateTitle = (content: string): string => {
  if (!content.trim()) return "";
  const firstLine = content.split("\n")[0].trim();
  return firstLine.slice(0, 20) + (firstLine.length > 20 ? "..." : "");
};

// Weather icon based on WMO code
const getWeatherIcon = (wmoCode: number | null): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  if (wmoCode === null) return { name: "help-outline", color: "#999" };
  if (wmoCode <= 1) return { name: "sunny", color: "#f97316" };
  if (wmoCode <= 3) return { name: "cloudy", color: "#6b7280" };
  if (wmoCode <= 48) return { name: "cloudy", color: "#6b7280" };
  if (wmoCode <= 67) return { name: "rainy", color: "#3b82f6" };
  if (wmoCode <= 77) return { name: "snow", color: "#22d3ee" };
  if (wmoCode <= 82) return { name: "rainy", color: "#3b82f6" };
  if (wmoCode <= 86) return { name: "snow", color: "#22d3ee" };
  return { name: "thunderstorm", color: "#8b5cf6" };
};

const formatTemperature = (weather: Weather | null): string | null => {
  if (!weather) return null;
  return `${weather.temperatureMin}℃〜${weather.temperatureMax}℃`;
};

export default function DiaryEditor({ diaryId }: DiaryEditorProps) {
  const router = useRouter();
  const navigation = useNavigation();

  const isNew = diaryId === null;

  const [diaryDbId, setDiaryDbId] = useState<string | null>(diaryId);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [location, setLocation] = useState<Location | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Track if user has made any edits (for new diary)
  const [userHasEdited, setUserHasEdited] = useState(false);
  // Track initial auto-fill completion
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Ref for debounced save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{
    title: string;
    date: string;
    content: string;
    location: Location | null;
    weather: Weather | null;
  } | null>(null);

  const autoTitle = useMemo(() => generateTitle(content), [content]);
  const isAutoTitle = !title.trim();
  const weatherIcon = getWeatherIcon(weather?.wmoCode ?? null);
  const temperature = formatTemperature(weather);

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardWillShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load existing diary or initialize new one
  useEffect(() => {
    if (isNew) {
      // New diary: get current location
      getCurrentLocation().then((loc) => {
        setLocation(loc);
        setInitialLoadComplete(true);
      });
    } else {
      // Existing diary: load from DB
      getDiary(diaryId!).then((d) => {
        if (d) {
          setTitle(d.title);
          setDate(parseDate(d.date));
          setContent(d.content);
          if (d.weather_wmo_code !== null && d.weather_description !== null && d.weather_temperature_min !== null && d.weather_temperature_max !== null) {
            setWeather({
              wmoCode: d.weather_wmo_code,
              description: d.weather_description,
              temperatureMin: d.weather_temperature_min,
              temperatureMax: d.weather_temperature_max,
            });
          }
          if (d.location_latitude && d.location_longitude) {
            setLocation({
              latitude: d.location_latitude,
              longitude: d.location_longitude,
              name: d.location_description ?? undefined,
              shortName: d.location_city ?? undefined,
            });
          }
          // Set initial saved state
          lastSavedRef.current = {
            title: d.title,
            date: d.date,
            content: d.content,
            location: d.location_latitude && d.location_longitude ? {
              latitude: d.location_latitude,
              longitude: d.location_longitude,
              name: d.location_description ?? undefined,
              shortName: d.location_city ?? undefined,
            } : null,
            weather: d.weather_wmo_code !== null ? {
              wmoCode: d.weather_wmo_code,
              description: d.weather_description!,
              temperatureMin: d.weather_temperature_min!,
              temperatureMax: d.weather_temperature_max!,
            } : null,
          };
        }
        setLoading(false);
        setInitialLoadComplete(true);
      });
    }
  }, [diaryId, isNew]);

  // Fetch weather when date or location changes
  useEffect(() => {
    if (!initialLoadComplete) return;

    const fetchWeather = async () => {
      if (!location) {
        setWeather(null);
        return;
      }
      setIsLoadingWeather(true);
      try {
        const dateStr = formatDate(date);
        const result = await getWeather(location.latitude, location.longitude, dateStr);
        setWeather(result);
      } finally {
        setIsLoadingWeather(false);
      }
    };
    fetchWeather();
  }, [date, location, initialLoadComplete]);

  // Auto-save function
  const performSave = useCallback(async () => {
    const currentTitle = title.trim() || generateTitle(content);
    const currentDate = formatDate(date);
    const currentContent = content.trim();

    // Check if anything changed from last save
    const lastSaved = lastSavedRef.current;
    if (lastSaved) {
      const hasChanges =
        lastSaved.title !== currentTitle ||
        lastSaved.date !== currentDate ||
        lastSaved.content !== currentContent ||
        lastSaved.location?.latitude !== location?.latitude ||
        lastSaved.location?.longitude !== location?.longitude ||
        lastSaved.weather?.wmoCode !== weather?.wmoCode ||
        lastSaved.weather?.temperatureMin !== weather?.temperatureMin ||
        lastSaved.weather?.temperatureMax !== weather?.temperatureMax;

      if (!hasChanges) return;
    }

    if (diaryDbId) {
      // Update existing
      await updateDiary(diaryDbId, currentTitle, currentDate, currentContent, location, weather);
    } else {
      // Create new
      const newDiary = await createDiary(currentTitle, currentDate, currentContent, location ?? undefined, weather ?? undefined);
      setDiaryDbId(newDiary.id);
    }

    // Update last saved state
    lastSavedRef.current = {
      title: currentTitle,
      date: currentDate,
      content: currentContent,
      location,
      weather,
    };
  }, [title, date, content, location, weather, diaryDbId]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!initialLoadComplete) return;

    // For new diary: only save after user has made edits
    if (isNew && !userHasEdited) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save (500ms delay)
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, date, content, location, weather, initialLoadComplete, isNew, userHasEdited, performSave]);

  // Wrapper functions to track user edits
  const handleTitleChange = (text: string) => {
    setTitle(text);
    setUserHasEdited(true);
  };

  const handleContentChange = (text: string) => {
    setContent(text);
    setUserHasEdited(true);
  };

  const handleDateChange = (newDate: Date) => {
    setDate(newDate);
    setUserHasEdited(true);
  };

  const handleLocationChange = (newLocation: Location | null) => {
    setLocation(newLocation);
    setUserHasEdited(true);
  };

  const handleDelete = () => {
    if (!diaryDbId) {
      router.back();
      return;
    }

    Alert.alert("確認", "この日記を削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          await deleteDiary(diaryDbId);
          router.back();
        },
      },
    ]);
  };

  // Header setup
  useLayoutEffect(() => {
    const headerTitle = isNew ? "新規作成" : formatDate(date).replace(/-/g, "/");

    navigation.setOptions({
      title: headerTitle,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isNew, date, diaryDbId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      {/* Meta Row - Collapsed */}
      <TouchableOpacity
        style={styles.metaRow}
        onPress={() => setIsMetaExpanded(!isMetaExpanded)}
      >
        <View style={styles.metaRowLeft}>
          <Text style={styles.metaDate}>{formatDateShort(date)}</Text>
          {location?.shortName && (
            <View style={styles.metaLocation}>
              <Ionicons name="location-outline" size={14} color="#999" />
              <Text style={styles.metaLocationText}>{location.shortName}</Text>
            </View>
          )}
          {weather && (
            <>
              <Ionicons name={weatherIcon.name} size={18} color={weatherIcon.color} />
              {temperature && <Text style={styles.metaTemperature}>{temperature}</Text>}
            </>
          )}
        </View>
        <Ionicons
          name={isMetaExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#999"
        />
      </TouchableOpacity>

      {/* Meta Row - Expanded */}
      {isMetaExpanded && (
        <View style={styles.metaExpanded}>
          {/* Date */}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>日付</Text>
            <TouchableOpacity
              style={styles.metaInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.metaInputText}>{formatDate(date)}</Text>
            </TouchableOpacity>
          </View>

          {/* Location */}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>場所</Text>
            <TouchableOpacity
              style={styles.metaInput}
              onPress={() => setShowLocationPicker(true)}
            >
              <Text style={location ? styles.metaInputText : styles.metaInputTextMuted}>
                {location?.name || location?.shortName || "タップして選択"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Weather */}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>天気</Text>
            <View style={styles.weatherDisplay}>
              {isLoadingWeather ? (
                <Text style={styles.weatherTextMuted}>取得中...</Text>
              ) : weather ? (
                <Text style={styles.weatherText}>{weather.description}  {temperature}</Text>
              ) : (
                <Text style={styles.weatherTextMuted}>-</Text>
              )}
            </View>
          </View>

          {/* Title */}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>題名</Text>
            <View style={styles.titleInputContainer}>
              <TextInput
                style={styles.metaTextInput}
                value={title}
                onChangeText={handleTitleChange}
                placeholder={autoTitle || "本文から自動設定"}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.clearButton, isAutoTitle && styles.clearButtonHidden]}
                onPress={() => handleTitleChange("")}
                disabled={isAutoTitle}
              >
                <Ionicons name="close" size={14} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <LocationPickerModal
        visible={showLocationPicker}
        initialLocation={location}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationChange}
      />

      <DatePickerModal
        visible={showDatePicker}
        initialDate={date}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateChange}
      />

      {/* Content */}
      <TextInput
        style={styles.contentInput}
        value={content}
        onChangeText={handleContentChange}
        multiline
        placeholder="今日あったことを書いてみましょう..."
        placeholderTextColor="#ccc"
        textAlignVertical="top"
        autoFocus={isNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  metaRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaDate: {
    fontSize: 14,
    color: "#666",
  },
  metaTemperature: {
    fontSize: 14,
    color: "#666",
  },
  metaLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  metaLocationText: {
    fontSize: 14,
    color: "#666",
  },
  metaExpanded: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    gap: 12,
  },
  metaField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaLabel: {
    fontSize: 14,
    color: "#999",
    width: 40,
  },
  metaInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaInputText: {
    fontSize: 14,
    color: "#333",
  },
  metaInputTextMuted: {
    fontSize: 14,
    color: "#999",
  },
  metaTextInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "400",
    color: "#333",
    padding: 0,
    margin: 0,
  },
  titleInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonHidden: {
    opacity: 0,
  },
  weatherDisplay: {
    flex: 1,
  },
  weatherText: {
    fontSize: 14,
    color: "#333",
  },
  weatherTextMuted: {
    fontSize: 14,
    color: "#999",
  },
  contentInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
});
