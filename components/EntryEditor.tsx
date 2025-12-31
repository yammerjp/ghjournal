import { useEffect, useLayoutEffect, useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  Keyboard,
  GestureResponderEvent,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Location, getEntry, deleteEntry } from "../lib/entry";
import { useSync } from "../contexts/SyncContext";
import { getCurrentLocation } from "../lib/location";
import {
  formatDate,
  parseDate,
  formatDateShort,
  formatDateTime,
  generateTitle,
  getWeatherIcon,
  formatTemperature,
} from "../lib/format";
import LocationPickerModal from "./LocationPickerModal";
import DatePickerModal from "./DatePickerModal";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { useWeatherFetch } from "../hooks/useWeatherFetch";
import { useEntryAutoSave } from "../hooks/useEntryAutoSave";
import { useContentEditor } from "../hooks/useContentEditor";

interface EntryEditorProps {
  entryId: string | null;
}

export default function EntryEditor({ entryId }: EntryEditorProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const { sync, isSyncing, isConnected } = useSync();

  const isNew = entryId === null;

  // Entry data states
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [content, setContent] = useState("");
  const [location, setLocation] = useState<Location | null>(null);

  // UI states
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);

  // Other states
  const [loading, setLoading] = useState(!isNew);
  const [userHasEdited, setUserHasEdited] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Custom hooks
  const keyboardHeight = useKeyboardHeight();
  const {
    weather,
    isLoading: isLoadingWeather,
    canRefresh: canRefreshWeather,
    refresh: refreshWeather,
    setWeather,
  } = useWeatherFetch(location, date);

  const {
    entryId: entryDbId,
    createdAt,
    updatedAt,
    setCreatedAt,
    setUpdatedAt,
  } = useEntryAutoSave({
    initialId: entryId,
    title,
    date,
    content,
    location,
    weather,
    enabled: initialLoadComplete && (!isNew || userHasEdited),
  });

  const {
    isEditing,
    selection,
    showTextInput,
    contentInputRef,
    handleTap,
    exitEditMode,
    onSelectionApplied,
    focusInput,
  } = useContentEditor({
    content,
    isNewAndEmpty: isNew && !content,
  });

  const autoTitle = useMemo(() => generateTitle(content), [content]);
  const isAutoTitle = !title.trim();
  const weatherIcon = getWeatherIcon(weather?.wmoCode ?? null);
  const temperature = formatTemperature(weather);

  // Load existing entry or initialize new one
  useEffect(() => {
    if (isNew) {
      // New entry: get current location
      getCurrentLocation().then((loc) => {
        setLocation(loc);
        setInitialLoadComplete(true);
      });
    } else {
      // Existing entry: load from DB
      getEntry(entryId!).then((e) => {
        if (e) {
          const loadedWeather =
            e.weather_wmo_code !== null &&
            e.weather_description !== null &&
            e.weather_temperature_min !== null &&
            e.weather_temperature_max !== null
              ? {
                  wmoCode: e.weather_wmo_code,
                  description: e.weather_description,
                  temperatureMin: e.weather_temperature_min,
                  temperatureMax: e.weather_temperature_max,
                }
              : null;

          const loadedLocation =
            e.location_latitude && e.location_longitude
              ? {
                  latitude: e.location_latitude,
                  longitude: e.location_longitude,
                  name: e.location_description ?? undefined,
                  shortName: e.location_city ?? undefined,
                }
              : null;

          setTitle(e.title);
          setDate(parseDate(e.date));
          setContent(e.content);
          setLocation(loadedLocation);
          setWeather(loadedWeather);
          setCreatedAt(e.created_at);
          setUpdatedAt(e.updated_at);
        }
        setLoading(false);
        setInitialLoadComplete(true);
      });
    }
  }, [entryId, isNew, setWeather, setCreatedAt, setUpdatedAt]);

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

  // Dismiss keyboard and exit editing mode
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    contentInputRef.current?.blur();
    exitEditMode();
  }, [exitEditMode, contentInputRef]);

  // Handle double tap to enter editing mode
  const handleContentAreaPress = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    handleTap(locationX, locationY);
    focusInput();
  }, [handleTap, focusInput]);

  // Open date picker with keyboard dismiss
  const openDatePicker = useCallback(() => {
    dismissKeyboard();
    setShowDatePicker(true);
  }, [dismissKeyboard]);

  // Open location picker with keyboard dismiss
  const openLocationPicker = useCallback(() => {
    dismissKeyboard();
    setShowLocationPicker(true);
  }, [dismissKeyboard]);

  const handleDelete = () => {
    if (!entryDbId) {
      router.back();
      return;
    }

    Alert.alert("確認", "この日記を削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          await deleteEntry(entryDbId);
          router.back();
        },
      },
    ]);
  };

  const showMenu = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["キャンセル", "削除"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleDelete();
          }
        }
      );
    } else {
      // Android: use Alert as a simple menu
      Alert.alert("メニュー", undefined, [
        { text: "キャンセル", style: "cancel" },
        { text: "削除", style: "destructive", onPress: handleDelete },
      ]);
    }
  };

  // Go back (entry is auto-saved, then sync)
  const handleGoBack = useCallback(() => {
    // Sync in background when closing (don't await to avoid blocking UI)
    if (isConnected && userHasEdited) {
      sync();
    }
    router.back();
  }, [router, isConnected, userHasEdited, sync]);

  // Manual sync
  const handleSync = useCallback(() => {
    sync();
  }, [sync]);

  // Header setup
  useLayoutEffect(() => {
    const headerTitle = isNew ? "新規作成" : formatDate(date).replace(/-/g, "/");

    navigation.setOptions({
      title: headerTitle,
      headerLeft: () => (
        <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          {isConnected && (
            <TouchableOpacity
              onPress={handleSync}
              style={styles.headerButton}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={22} color="#007AFF" />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={showMenu} style={styles.headerButton}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isNew, date, entryDbId, handleGoBack, isConnected, isSyncing, handleSync]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
        {/* Meta Row - Collapsed */}
        <TouchableOpacity
          style={styles.metaRow}
          onPress={() => {
            dismissKeyboard();
            setIsMetaExpanded(!isMetaExpanded);
          }}
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
              onPress={openDatePicker}
            >
              <Text style={styles.metaInputText}>{formatDate(date)}</Text>
            </TouchableOpacity>
          </View>

          {/* Location */}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>場所</Text>
            <TouchableOpacity
              style={styles.metaInput}
              onPress={openLocationPicker}
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
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshWeather}
              disabled={!canRefreshWeather}
            >
              <Ionicons
                name="refresh"
                size={18}
                color={canRefreshWeather ? "#007AFF" : "#ccc"}
              />
            </TouchableOpacity>
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

          {/* Timestamps */}
          {(createdAt || updatedAt) && (
            <View style={styles.timestampsContainer}>
              {createdAt && (
                <Text style={styles.timestampText}>作成: {formatDateTime(createdAt)}</Text>
              )}
              {updatedAt && (
                <Text style={styles.timestampText}>更新: {formatDateTime(updatedAt)}</Text>
              )}
            </View>
          )}
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
      {showTextInput ? (
        <TextInput
          ref={contentInputRef}
          style={styles.contentInput}
          value={content}
          onChangeText={handleContentChange}
          onBlur={exitEditMode}
          onSelectionChange={onSelectionApplied}
          selection={selection}
          multiline
          placeholder="今日あったことを書いてみましょう..."
          placeholderTextColor="#ccc"
          textAlignVertical="top"
          autoFocus={isNew && !content}
        />
      ) : (
        <TouchableWithoutFeedback onPress={handleContentAreaPress}>
          <View style={styles.contentArea}>
            <Text style={content ? styles.contentText : styles.contentPlaceholder}>
              {content || "ダブルタップで編集..."}
            </Text>
          </View>
        </TouchableWithoutFeedback>
      )}
      </View>
    </TouchableWithoutFeedback>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
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
  refreshButton: {
    padding: 8,
  },
  timestampsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 4,
  },
  timestampText: {
    fontSize: 12,
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
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  contentPlaceholder: {
    fontSize: 16,
    lineHeight: 24,
    color: "#ccc",
  },
});
