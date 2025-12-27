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
import { createDiary } from "../../lib/diary";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function NewDiary() {
  const router = useRouter();
  const navigation = useNavigation();
  const [date, setDate] = useState(new Date());
  const [content, setContent] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const contentRef = useRef({ date, content });

  contentRef.current = { date, content };

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
    const { date: currentDate, content: currentContent } = contentRef.current;
    await createDiary(formatDate(currentDate), currentContent.trim());
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
});
