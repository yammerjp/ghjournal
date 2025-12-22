import { useCallback, useLayoutEffect, useState } from "react";
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Diary, getDiaries } from "../lib/diary";

export default function Index() {
  const router = useRouter();
  const navigation = useNavigation();
  const [diaries, setDiaries] = useState<Diary[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push("/diaries/new")}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, router]);

  useFocusEffect(
    useCallback(() => {
      getDiaries().then(setDiaries);
    }, [])
  );

  const renderItem = ({ item }: { item: Diary }) => (
    <TouchableOpacity
      style={styles.diaryItem}
      onPress={() => router.push(`/diaries/${item.id}`)}
    >
      <Text style={styles.diaryDate}>{item.date}</Text>
      <Text style={styles.diaryContent} numberOfLines={2}>
        {item.content}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={diaries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>日記がありません</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 28,
    color: "#007AFF",
    fontWeight: "400",
  },
  diaryItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  diaryDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  diaryContent: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    color: "#999",
  },
});
