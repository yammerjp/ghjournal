import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { createDiary, Location, Weather } from "../../lib/diary";
import { getCurrentLocation } from "../../lib/location";
import { getWeather } from "../../lib/weather";
import { isWeatherEnabled } from "../../lib/secrets";
import LocationPickerModal from "../../components/LocationPickerModal";
import DatePickerModal from "../../components/DatePickerModal";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  if (wmoCode <= 1) return { name: "sunny", color: "#f97316" }; // 快晴・晴れ
  if (wmoCode <= 3) return { name: "cloudy", color: "#6b7280" }; // くもり
  if (wmoCode <= 48) return { name: "cloudy", color: "#6b7280" }; // 霧
  if (wmoCode <= 67) return { name: "rainy", color: "#3b82f6" }; // 雨
  if (wmoCode <= 77) return { name: "snow", color: "#22d3ee" }; // 雪
  if (wmoCode <= 82) return { name: "rainy", color: "#3b82f6" }; // にわか雨
  if (wmoCode <= 86) return { name: "snow", color: "#22d3ee" }; // にわか雪
  return { name: "thunderstorm", color: "#8b5cf6" }; // 雷雨
};

// Format temperature for display
const formatTemperature = (weather: Weather | null): string | null => {
  if (!weather) return null;
  return `${weather.temperatureMin}℃〜${weather.temperatureMax}℃`;
};

export default function NewDiary() {
  const router = useRouter();
  const navigation = useNavigation();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date());
  const [content, setContent] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const contentRef = useRef({ title, date, content, location, weather });

  contentRef.current = { title, date, content, location, weather };

  const autoTitle = useMemo(() => generateTitle(content), [content]);
  const isAutoTitle = !title.trim();
  const weatherIcon = getWeatherIcon(weather?.wmoCode ?? null);
  const temperature = formatTemperature(weather);

  useEffect(() => {
    getCurrentLocation().then((loc) => {
      setLocation(loc);
    });
    isWeatherEnabled().then(setWeatherEnabled);
  }, []);

  // Fetch weather when date or location changes
  useEffect(() => {
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
  }, [date, location]);

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

  const handleSave = async () => {
    const { title: currentTitle, date: currentDate, content: currentContent, location: currentLocation, weather: currentWeather } = contentRef.current;
    const dateStr = formatDate(currentDate);
    const finalTitle = currentTitle.trim() || generateTitle(currentContent);
    await createDiary(finalTitle, dateStr, currentContent.trim(), currentLocation ?? undefined, currentWeather ?? undefined);
    router.back();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>保存</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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
                onChangeText={setTitle}
                placeholder={autoTitle || "本文から自動設定"}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.clearButton, isAutoTitle && styles.clearButtonHidden]}
                onPress={() => setTitle("")}
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
        onSelect={setLocation}
      />

      <DatePickerModal
        visible={showDatePicker}
        initialDate={date}
        onClose={() => setShowDatePicker(false)}
        onSelect={setDate}
      />

      {/* Content */}
      <TextInput
        style={styles.contentInput}
        value={content}
        onChangeText={setContent}
        multiline
        placeholder="今日あったことを書いてみましょう..."
        placeholderTextColor="#ccc"
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
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
