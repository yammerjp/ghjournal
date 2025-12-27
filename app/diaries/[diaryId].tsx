import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { Diary, getDiary, updateDiary, deleteDiary } from "../../lib/diary";

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
  const stateRef = useRef({ title, date, content, diary, isEditing });

  stateRef.current = { title, date, content, diary, isEditing };

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
        }
        setLoading(false);
      });
    }
  }, [diaryId]);

  const handleSave = async () => {
    const { title: currentTitle, date: currentDate, content: currentContent } = stateRef.current;
    const dateStr = formatDate(currentDate);
    await updateDiary(diaryId!, currentTitle.trim(), dateStr, currentContent.trim());
    setIsEditing(false);
    setDiary((prev) =>
      prev ? { ...prev, title: currentTitle.trim(), date: dateStr, content: currentContent.trim() } : null
    );
  };

  const handleCancel = () => {
    const { diary: currentDiary } = stateRef.current;
    if (currentDiary) {
      setTitle(currentDiary.title);
      setDate(parseDate(currentDiary.date));
      setContent(currentDiary.content);
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

  if (isEditing) {
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

        <Text style={styles.label}>内容</Text>
        <TextInput
          style={styles.contentInput}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {diary.title ? <Text style={styles.title}>{diary.title}</Text> : null}
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
  titleInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
  deleteButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 17,
  },
});
