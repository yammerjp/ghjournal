import { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from "react";
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
  LayoutChangeEvent,
} from "react-native";
import { getCharacterIndex } from "../modules/expo-text-cursor/src";
import { useRouter, useNavigation } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Location, getEntry, getEntryByDate, deleteEntry } from "../lib/entry";
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

interface EntryEditorProps {
  entryId: string | null;
}

export default function EntryEditor({ entryId }: EntryEditorProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { sync, isConnected } = useSync();

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

  // Content editing
  const contentInputRef = useRef<TextInput>(null);
  const [isEditable, setIsEditable] = useState(isNew);
  const [contentAreaWidth, setContentAreaWidth] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const scrollOffsetRef = useRef(0);

  // コンテンツエリアのレイアウト変更時に幅を取得
  const handleContentAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContentAreaWidth(width);
  }, []);

  // スクロール位置を追跡
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

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

  const handleDateChange = async (newDate: Date) => {
    const dateStr = formatDate(newDate);
    const existingEntry = await getEntryByDate(dateStr);

    if (existingEntry && existingEntry.id !== entryDbId) {
      Alert.alert(
        t('entry.dateConflict.title'),
        t('entry.dateConflict.message', { date: dateStr }),
        [
          {
            text: t('entry.dateConflict.open'),
            onPress: () => router.replace(`/entries/${existingEntry.id}`),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
      return;
    }

    setDate(newDate);
    setUserHasEdited(true);
  };

  const handleLocationChange = (newLocation: Location | null) => {
    setLocation(newLocation);
    setUserHasEdited(true);
  };

  // Dismiss keyboard
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    contentInputRef.current?.blur();
  }, []);

  // Calculate cursor position from tap location
  const calculateCursorPosition = useCallback((locationX: number, locationY: number): number => {
    const PADDING_TOP = 16;
    const PADDING_HORIZONTAL = 16;
    const FONT_SIZE = 16;
    const LINE_HEIGHT = 24;

    const adjustedX = locationX - PADDING_HORIZONTAL;
    // スクロールオフセットを加算して、テキスト全体での位置を計算
    const adjustedY = locationY - PADDING_TOP + scrollOffsetRef.current;

    // iOSではネイティブモジュールを使用、それ以外はフォールバック
    if (Platform.OS === "ios" && contentAreaWidth > 0) {
      try {
        const containerWidth = contentAreaWidth - PADDING_HORIZONTAL * 2;
        return getCharacterIndex(content, adjustedX, adjustedY, FONT_SIZE, LINE_HEIGHT, containerWidth);
      } catch (e) {
        console.warn("Failed to get character index from native module:", e);
      }
    }

    // フォールバック: 近似計算
    const AVG_CHAR_WIDTH = 12;

    const lines = content.split('\n');
    const lineIndex = Math.max(0, Math.min(Math.floor(adjustedY / LINE_HEIGHT), lines.length - 1));

    let charIndex = 0;
    for (let i = 0; i < lineIndex; i++) {
      charIndex += lines[i].length + 1;
    }

    const col = Math.max(0, Math.floor(adjustedX / AVG_CHAR_WIDTH));
    charIndex += Math.min(col, lines[lineIndex]?.length ?? 0);

    return Math.min(charIndex, content.length);
  }, [content, contentAreaWidth]);

  // Handle touch to distinguish tap from scroll
  const handleTouchStart = useCallback((e: any) => {
    touchStartRef.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback((e: any) => {
    if (!touchStartRef.current || isEditable) return;

    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const endX = e.nativeEvent.pageX;
    const endY = e.nativeEvent.pageY;
    const deltaX = Math.abs(endX - startX);
    const deltaY = Math.abs(endY - startY);
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Tap: small movement and short duration
    const TAP_THRESHOLD = 10;
    const TAP_DURATION = 300;

    if (deltaX < TAP_THRESHOLD && deltaY < TAP_THRESHOLD && deltaTime < TAP_DURATION) {
      // It's a tap - calculate cursor position using local coordinates
      const localX = e.nativeEvent.locationX;
      const localY = e.nativeEvent.locationY;
      const cursorPos = calculateCursorPosition(localX, localY);

      setIsEditable(true);
      setTimeout(() => {
        contentInputRef.current?.focus();
        setTimeout(() => {
          contentInputRef.current?.setSelection(cursorPos, cursorPos);
        }, 50);
      }, 50);
    }

    touchStartRef.current = null;
  }, [isEditable, calculateCursorPosition]);

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

  // Navigate to home or back
  const navigateBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const handleDelete = () => {
    if (!entryDbId) {
      navigateBack();
      return;
    }

    Alert.alert(t('common.confirm'), t('entry.deleteConfirm'), [
      { text: t('common.cancel'), style: "cancel" },
      {
        text: t('common.delete'),
        style: "destructive",
        onPress: async () => {
          await deleteEntry(entryDbId);
          navigateBack();
        },
      },
    ]);
  };

  const showMenu = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('common.delete')],
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
      Alert.alert(t('entry.edit'), undefined, [
        { text: t('common.cancel'), style: "cancel" },
        { text: t('common.delete'), style: "destructive", onPress: handleDelete },
      ]);
    }
  };

  // Go back (entry is auto-saved, then sync)
  const handleGoBack = useCallback(() => {
    // Sync in background when closing (don't await to avoid blocking UI)
    if (isConnected && userHasEdited) {
      sync();
    }
    navigateBack();
  }, [navigateBack, isConnected, userHasEdited, sync]);

  // Header setup
  useLayoutEffect(() => {
    const headerTitle = isNew ? t('entry.new') : formatDate(date).replace(/-/g, "/");

    navigation.setOptions({
      title: headerTitle,
      headerLeft: () => (
        <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={showMenu} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isNew, date, entryDbId, handleGoBack]);

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
            <Text style={styles.metaLabel}>{t('entry.date')}</Text>
            <TouchableOpacity
              style={styles.metaInput}
              onPress={openDatePicker}
            >
              <Text style={styles.metaInputText}>{formatDate(date)}</Text>
            </TouchableOpacity>
          </View>

          {/* Location */}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>{t('entry.location')}</Text>
            <TouchableOpacity
              style={styles.metaInput}
              onPress={openLocationPicker}
            >
              <Text style={location ? styles.metaInputText : styles.metaInputTextMuted}>
                {location?.name || location?.shortName || "-"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Weather */}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>{t('entry.weather')}</Text>
            <View style={styles.weatherDisplay}>
              {isLoadingWeather ? (
                <Text style={styles.weatherTextMuted}>{t('common.loading')}</Text>
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
            <Text style={styles.metaLabel}>{t('entry.title')}</Text>
            <View style={styles.titleInputContainer}>
              <TextInput
                style={styles.metaTextInput}
                value={title}
                onChangeText={handleTitleChange}
                placeholder={autoTitle || t('entry.titlePlaceholder')}
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
                <Text style={styles.timestampText}>{t('entry.createdAt')}: {formatDateTime(createdAt)}</Text>
              )}
              {updatedAt && (
                <Text style={styles.timestampText}>{t('entry.updatedAt')}: {formatDateTime(updatedAt)}</Text>
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
      <View
        style={styles.contentArea}
        onLayout={handleContentAreaLayout}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <TextInput
          ref={contentInputRef}
          style={styles.contentInput}
          value={content}
          onChangeText={handleContentChange}
          onScroll={handleScroll}
          editable={isEditable}
          multiline
          placeholder={t('entry.placeholder')}
          placeholderTextColor="#ccc"
          textAlignVertical="top"
          autoFocus={isNew}
          scrollEnabled={true}
        />
      </View>
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
    width: 60,
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
  contentArea: {
    flex: 1,
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
