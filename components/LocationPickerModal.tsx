import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import { Location } from "../lib/entry";
import { getCurrentLocation, reverseGeocode } from "../lib/location";

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
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    initialLocation
  );
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState<string | undefined>(
    initialLocation?.name
  );

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
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLoading(true);
    const { name, shortName } = await reverseGeocode(latitude, longitude);
    setSelectedLocation({ latitude, longitude, name, shortName });
    setLocationName(name);
    setLoading(false);
  };

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    const loc = await getCurrentLocation();
    if (loc) {
      setSelectedLocation(loc);
      setLocationName(loc.name);
      setRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
    setLoading(false);
  };

  const handleClear = () => {
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
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>場所を選択</Text>
          <TouchableOpacity onPress={handleDone} style={styles.headerButton}>
            <Text style={styles.doneButtonText}>完了</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.locationInfo}>
          {loading ? (
            <ActivityIndicator size="small" />
          ) : selectedLocation ? (
            <Text style={styles.locationText} numberOfLines={2}>
              {locationName ||
                `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`}
            </Text>
          ) : (
            <Text style={styles.locationTextMuted}>場所が選択されていません</Text>
          )}
        </View>

        <MapView
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
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

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleUseCurrentLocation}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>現在地を使用</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton]}
            onPress={handleClear}
            disabled={loading}
          >
            <Text style={styles.clearButtonText}>クリア</Text>
          </TouchableOpacity>
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
  locationInfo: {
    padding: 16,
    minHeight: 60,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  locationText: {
    fontSize: 16,
    color: "#333",
  },
  locationTextMuted: {
    fontSize: 16,
    color: "#999",
  },
  map: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#007AFF",
    borderRadius: 10,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  clearButtonText: {
    color: "#FF3B30",
    fontSize: 17,
    fontWeight: "600",
  },
});
