import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useNavigation, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Diary, Location, Weather, getDiary, updateDiary, deleteDiary } from "../../lib/diary";
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

export default function DiaryDetail() {
  const router = useRouter();
  const navigation = useNavigation();
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  const [diary, setDiary] = useState<Diary | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [location, setLocation] = useState<Location | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const stateRef = useRef({ title, date, content, diary, isEditing, location, weather });

  const autoTitle = useMemo(() => generateTitle(content), [content]);
  const isAutoTitle = !title.trim();
  const weatherIcon = getWeatherIcon(weather?.wmoCode ?? null);
  const temperature = formatTemperature(weather);

  stateRef.current = { title, date, content, diary, isEditing, location, weather };

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

  useEffect(() => {
    if (diaryId) {
      getDiary(diaryId).then((d) => {
        setDiary(d);
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
        }
        setLoading(false);
      });
      isWeatherEnabled().then(setWeatherEnabled);
    }
  }, [diaryId]);

  // Fetch weather when date or location changes during editing
  useEffect(() => {
    if (!isEditing || !diary) return;

    const dateStr = formatDate(date);
    const dateChanged = diary.date !== dateStr;
    const locationChanged =
      diary.location_latitude !== location?.latitude ||
      diary.location_longitude !== location?.longitude;

    // Only fetch if something changed and location is available
    if ((dateChanged || locationChanged) && location) {
      const fetchWeather = async () => {
        setIsLoadingWeather(true);
        try {
          const result = await getWeather(location.latitude, location.longitude, dateStr);
          setWeather(result);
        } finally {
          setIsLoadingWeather(false);
        }
      };
      fetchWeather();
    } else if (!location) {
      setWeather(null);
    }
  }, [date, location, isEditing, diary]);

  const handleSave = async () => {
    const { title: currentTitle, date: currentDate, content: currentContent, location: currentLocation, weather: currentWeather } = stateRef.current;
    const dateStr = formatDate(currentDate);

    await updateDiary(diaryId!, currentTitle.trim(), dateStr, currentContent.trim(), currentLocation, currentWeather);
    setIsEditing(false);
    setDiary((prev) =>
      prev ? {
        ...prev,
        title: currentTitle.trim(),
        date: dateStr,
        content: currentContent.trim(),
        location_latitude: currentLocation?.latitude ?? null,
        location_longitude: currentLocation?.longitude ?? null,
        location_description: currentLocation?.name ?? null,
        location_city: currentLocation?.shortName ?? null,
        weather_wmo_code: currentWeather?.wmoCode ?? null,
        weather_description: currentWeather?.description ?? null,
        weather_temperature_min: currentWeather?.temperatureMin ?? null,
        weather_temperature_max: currentWeather?.temperatureMax ?? null,
      } : null
    );
  };

  const handleCancel = () => {
    const { diary: currentDiary } = stateRef.current;
    if (currentDiary) {
      setTitle(currentDiary.title);
      setDate(parseDate(currentDiary.date));
      setContent(currentDiary.content);
      if (currentDiary.weather_wmo_code !== null && currentDiary.weather_description !== null && currentDiary.weather_temperature_min !== null && currentDiary.weather_temperature_max !== null) {
        setWeather({
          wmoCode: currentDiary.weather_wmo_code,
          description: currentDiary.weather_description,
          temperatureMin: currentDiary.weather_temperature_min,
          temperatureMax: currentDiary.weather_temperature_max,
        });
      } else {
        setWeather(null);
      }
      if (currentDiary.location_latitude && currentDiary.location_longitude) {
        setLocation({
          latitude: currentDiary.location_latitude,
          longitude: currentDiary.location_longitude,
          name: currentDiary.location_description ?? undefined,
          shortName: currentDiary.location_city ?? undefined,
        });
      } else {
        setLocation(null);
      }
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert("確認", "この日記を削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          await deleteDiary(diaryId!);
          router.back();
        },
      },
    ]);
  };

  useLayoutEffect(() => {
    if (loading) return;

    const headerTitle = diary ? diary.date.replace(/-/g, "/") : "";

    if (isEditing) {
      navigation.setOptions({
        title: headerTitle,
        headerLeft: () => (
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>キャンセル</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
            <Text style={styles.headerButtonTextBold}>保存</Text>
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        title: headerTitle,
        headerLeft: undefined,
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>編集</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, isEditing, loading, diary]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!diary) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>日記が見つかりません</Text>
      </View>
    );
  }

  const locationDisplay = diary.location_description ||
    (diary.location_latitude && diary.location_longitude
      ? `${diary.location_latitude.toFixed(4)}, ${diary.location_longitude.toFixed(4)}`
      : null);

  const weatherDisplay = diary.weather_description && diary.weather_temperature_min !== null && diary.weather_temperature_max !== null
    ? `${diary.weather_description}  ${diary.weather_temperature_min}℃〜${diary.weather_temperature_max}℃`
    : null;

  if (isEditing) {
    return (
      <View style={[styles.container, styles.editContainer, { paddingBottom: keyboardHeight }]}>
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
          style={styles.contentInputEdit}
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

  return (
    <View style={styles.container}>
      {diary.title ? <Text style={styles.title}>{diary.title}</Text> : null}
      {(locationDisplay || weatherDisplay) ? (
        <Text style={styles.metaText}>
          {[locationDisplay, weatherDisplay].filter(Boolean).join(' / ')}
        </Text>
      ) : null}
      <ScrollView style={styles.contentScroll}>
        <Text style={styles.content}>{diary.content}</Text>
      </ScrollView>
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>この日記を削除</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  editContainer: {
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 17,
    color: "#007AFF",
  },
  headerButtonTextBold: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
  errorText: {
    textAlign: "center",
    marginTop: 40,
    color: "#999",
  },
  deleteButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 17,
  },
  metaText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  // Collapsible meta styles
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
  contentInputEdit: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
});
