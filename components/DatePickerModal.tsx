import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";

interface DatePickerModalProps {
  visible: boolean;
  initialDate: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
}

export default function DatePickerModal({
  visible,
  initialDate,
  onClose,
  onSelect,
}: DatePickerModalProps) {
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  useEffect(() => {
    if (visible) {
      setSelectedDate(initialDate);
    }
  }, [visible, initialDate]);

  const handleDone = () => {
    onSelect(selectedDate);
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
          <Text style={styles.headerTitle}>{t('entry.selectDate')}</Text>
          <TouchableOpacity onPress={handleDone} style={styles.headerButton}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="inline"
            locale={i18n.language === 'ja' ? 'ja-JP' : 'en-US'}
            maximumDate={new Date()}
            onChange={(_, date) => {
              if (date) setSelectedDate(date);
            }}
            style={styles.picker}
          />
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
  pickerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  picker: {
    width: "100%",
    height: 350,
  },
});
