import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import * as Clipboard from "expo-clipboard";
import { DiaryVersion, getDiaryVersions, restoreVersion } from "../lib/diary";
import { formatDateTime } from "../lib/format";

interface VersionHistoryModalProps {
  visible: boolean;
  diaryId: string | null;
  onClose: () => void;
  onRestore: () => void;
}

export default function VersionHistoryModal({
  visible,
  diaryId,
  onClose,
  onRestore,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<DiaryVersion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (visible && diaryId) {
      getDiaryVersions(diaryId).then((v) => {
        setVersions(v);
        // Start at the newest version (rightmost position)
        setSelectedIndex(v.length - 1);
      });
    }
  }, [visible, diaryId]);

  // Invert index so slider right = newest, left = oldest
  // versions is sorted DESC (newest first), so we need to reverse the mapping
  const actualVersionIndex = versions.length - 1 - selectedIndex;
  const selectedVersion = versions[actualVersionIndex] || null;
  const isLatest = actualVersionIndex === 0;

  const handleRestore = useCallback(async () => {
    if (!diaryId || !selectedVersion || isLatest) return;

    Alert.alert(
      "確認",
      "この状態に復元しますか？現在の内容は履歴に保存されます。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "復元",
          onPress: async () => {
            setIsRestoring(true);
            try {
              const success = await restoreVersion(diaryId, selectedVersion.id);
              if (success) {
                onRestore();
                onClose();
              } else {
                Alert.alert("エラー", "復元に失敗しました");
              }
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  }, [diaryId, selectedVersion, isLatest, onRestore, onClose]);

  const handleCopyContent = useCallback(async () => {
    if (!selectedVersion) return;
    await Clipboard.setStringAsync(selectedVersion.content);
    Alert.alert("コピーしました", "本文をクリップボードにコピーしました");
  }, [selectedVersion]);

  const handleSliderChange = (value: number) => {
    setSelectedIndex(Math.round(value));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.cancelButtonText}>閉じる</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>編集履歴</Text>
          <View style={styles.headerButton} />
        </View>

        {versions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>履歴がありません</Text>
          </View>
        ) : (
          <>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                {versions.length > 1
                  ? `${selectedIndex + 1} / ${versions.length}`
                  : "1 / 1"}
              </Text>
              {versions.length > 1 && (
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={versions.length - 1}
                  step={1}
                  value={selectedIndex}
                  onValueChange={handleSliderChange}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#e0e0e0"
                  thumbTintColor="#007AFF"
                />
              )}
              {selectedVersion && (
                <Text style={styles.versionDate}>
                  {formatDateTime(selectedVersion.created_at)}
                  {isLatest && " (最新)"}
                </Text>
              )}
            </View>

            <ScrollView style={styles.contentContainer}>
              {selectedVersion && (
                <>
                  {selectedVersion.title ? (
                    <Text style={styles.versionTitle}>{selectedVersion.title}</Text>
                  ) : null}
                  <Text style={styles.versionContent}>
                    {selectedVersion.content || "(本文なし)"}
                  </Text>
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyContent}
              >
                <Text style={styles.copyButtonText}>本文をコピー</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.restoreButton, (isLatest || isRestoring) && styles.restoreButtonDisabled]}
                onPress={handleRestore}
                disabled={isLatest || isRestoring}
              >
                <Text style={styles.restoreButtonText}>
                  {isRestoring ? "復元中..." : "この状態に復元"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
  sliderContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    alignItems: "center",
  },
  sliderLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  versionDate: {
    fontSize: 14,
    color: "#007AFF",
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  versionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  versionContent: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    gap: 10,
  },
  copyButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  copyButtonText: {
    color: "#007AFF",
    fontSize: 17,
    fontWeight: "600",
  },
  restoreButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
