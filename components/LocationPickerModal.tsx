import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Alert,
  ScrollView,
  Keyboard,
} from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Location } from "../lib/entry";
import { getCurrentLocation, reverseGeocode, searchLocations } from "../lib/location";

interface LocationPickerModalProps {
  visible: boolean;
  initialLocation: Location | null;
  onClose: () => void;
  onSelect: (location: Location | null) => void;
}

const { width, height } = Dimensions.get("window");

const DEFAULT_REGION: Region = {
  latitude: 35.6812,
  longitude: 139.7671,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function LocationPickerModal({
  visible,
  initialLocation,
  onClose,
  onSelect,
}: LocationPickerModalProps) {
  const { t } = useTranslation();
  const mapRef = useRef<MapView>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    initialLocation
  );
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState<string | undefined>(
    initialLocation?.name
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);

  useEffect(() => {
    if (visible) {
      setSelectedLocation(initialLocation);
      setLocationName(initialLocation?.name);
      if (initialLocation) {
        setRegion({
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        // If no initial location, try to get current location for map center
        getCurrentLocation().then((loc) => {
          if (loc) {
            setRegion({
              latitude: loc.latitude,
              longitude: loc.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        });
      }
    }
  }, [visible, initialLocation]);

  const handleMapPress = async (event: MapPressEvent) => {
    Keyboard.dismiss();
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLoading(true);
    const { name, shortName } = await reverseGeocode(latitude, longitude);
    setSelectedLocation({ latitude, longitude, name, shortName });
    setLocationName(name);
    setLoading(false);
  };

  const handleUseCurrentLocation = async () => {
    Keyboard.dismiss();
    setLoading(true);
    const loc = await getCurrentLocation();
    if (loc) {
      setSelectedLocation(loc);
      setLocationName(loc.name);
      const newRegion = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 300);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearchResults([]);

    try {
      const results = await searchLocations(searchQuery);

      if (results.length > 0) {
        setSearchResults(results);
      } else {
        Alert.alert(t('common.error'), t('entry.locationNotFound'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSearchResult = (location: Location) => {
    setSelectedLocation(location);
    setLocationName(location.name);
    const newRegion = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
    setSearchResults([]);
  };

  const handleClear = () => {
    Keyboard.dismiss();
    setSelectedLocation(null);
    setLocationName(undefined);
  };

  const handleDone = () => {
    onSelect(selectedLocation);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('entry.selectLocation')}</Text>
          <TouchableOpacity onPress={handleDone} style={styles.headerButton}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchWrapper, searchResults.length > 0 && styles.searchWrapperActive]}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('entry.searchPlaceholder')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.searchResultsDropdown}>
              <ScrollView style={styles.searchResultsScroll} keyboardShouldPersistTaps="handled">
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={`${result.latitude}-${result.longitude}-${index}`}
                    style={styles.searchResultItem}
                    onPress={() => handleSelectSearchResult(result)}
                  >
                    <Ionicons name="location-outline" size={18} color="#666" style={styles.searchResultIcon} />
                    <View style={styles.searchResultTextContainer}>
                      <Text style={styles.searchResultText} numberOfLines={1}>
                        {result.name || `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`}
                      </Text>
                      {result.shortName && (
                        <Text style={styles.searchResultSubText}>{result.shortName}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {selectedLocation && (
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                }}
              />
            )}
          </MapView>

          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={handleUseCurrentLocation}
            disabled={loading}
          >
            <Ionicons name="navigate" size={22} color="#007AFF" />
          </TouchableOpacity>

          <View style={styles.locationSheet}>
            {loading ? (
              <ActivityIndicator size="small" />
            ) : selectedLocation ? (
              <View style={styles.selectedLocationRow}>
                <Ionicons name="location" size={20} color="#FF3B30" style={styles.pinIcon} />
                <Text style={styles.locationText} numberOfLines={2}>
                  {locationName ||
                    `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`}
                </Text>
                <TouchableOpacity
                  style={styles.clearIconButton}
                  onPress={handleClear}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.locationTextMuted}>{t('entry.noLocationSelected')}</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerButton: {
    minWidth: 80,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cancelButtonText: {
    fontSize: 17,
    color: "#007AFF",
  },
  doneButtonText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
    textAlign: "right",
  },
  searchWrapper: {
  },
  searchWrapperActive: {
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: "#f8f8f8",
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 16,
  },
  searchResultsDropdown: {
    position: "absolute",
    top: "100%",
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  searchResultsScroll: {
    flexGrow: 0,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchResultIcon: {
    marginRight: 12,
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultText: {
    fontSize: 16,
    color: "#333",
  },
  searchResultSubText: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  selectedLocationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pinIcon: {
    marginRight: 8,
  },
  locationSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    paddingBottom: 32,
    minHeight: 70,
    justifyContent: "center",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  locationTextMuted: {
    fontSize: 16,
    color: "#999",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: "absolute",
    bottom: 100,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  clearIconButton: {
    marginLeft: "auto",
    padding: 8,
  },
});
