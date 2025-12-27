import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { createDiary, Location } from "../../lib/diary";
import { getCurrentLocation } from "../../lib/location";
import { getWeather } from "../../lib/weather";
import LocationPickerModal from "../../components/LocationPickerModal";
import RefreshWeatherButton from "../../components/RefreshWeatherButton";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function NewDiary() {
  const router = useRouter();
  const navigation = useNavigation();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date());
  const [content, setContent] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const contentRef = useRef({ title, date, content, location, weather });

  contentRef.current = { title, date, content, location, weather };

  useEffect(() => {
    getCurrentLocation().then((loc) => {
      setLocation(loc);
    });
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
    await createDiary(currentTitle.trim(), dateStr, currentContent.trim(), currentLocation ?? undefined, currentWeather ?? undefined);
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
      <Text style={styles.label}>タイトル</Text>
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        placeholder="タイトル（任意）"
      />

      <Text style={styles.label}>日付</Text>
      <DateTimePicker
        value={date}
        mode="date"
        display="default"
        onChange={(_, selectedDate) => {
          if (selectedDate) setDate(selectedDate);
        }}
        style={styles.datePicker}
      />

      <Text style={styles.label}>場所</Text>
      <TouchableOpacity
        style={styles.locationContainer}
        onPress={() => setShowLocationPicker(true)}
      >
        {location ? (
          <Text style={styles.locationText}>
            {location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
          </Text>
        ) : (
          <Text style={styles.locationTextMuted}>タップして場所を選択</Text>
        )}
        <Text style={styles.locationChevron}>›</Text>
      </TouchableOpacity>

      <LocationPickerModal
        visible={showLocationPicker}
        initialLocation={location}
        onClose={() => setShowLocationPicker(false)}
        onSelect={setLocation}
      />

      <Text style={styles.label}>天気</Text>
      <View style={styles.weatherRow}>
        <View style={styles.weatherContainer}>
          {isLoadingWeather ? (
            <Text style={styles.weatherTextMuted}>取得中...</Text>
          ) : weather ? (
            <Text style={styles.weatherText}>{weather}</Text>
          ) : (
            <Text style={styles.weatherTextMuted}>
              {location ? "天気データなし" : "場所を設定すると天気を取得します"}
            </Text>
          )}
        </View>
        <RefreshWeatherButton
          onRefresh={async () => {
            if (!location) return;
            setIsLoadingWeather(true);
            try {
              const dateStr = formatDate(date);
              const result = await getWeather(location.latitude, location.longitude, dateStr);
              setWeather(result);
            } finally {
              setIsLoadingWeather(false);
            }
          }}
          disabled={!location || isLoadingWeather}
        />
      </View>

      <Text style={styles.label}>内容</Text>
      <TextInput
        style={styles.contentInput}
        value={content}
        onChangeText={setContent}
        multiline
        placeholder="今日の出来事を書いてください..."
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
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
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  datePicker: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  contentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
  },
  locationText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  locationTextMuted: {
    fontSize: 16,
    color: "#999",
    flex: 1,
  },
  locationChevron: {
    fontSize: 20,
    color: "#999",
    marginLeft: 8,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  weatherContainer: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  weatherText: {
    fontSize: 16,
    color: "#333",
  },
  weatherTextMuted: {
    fontSize: 16,
    color: "#999",
  },
});
