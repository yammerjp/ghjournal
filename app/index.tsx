import { useCallback, useLayoutEffect, useState } from "react";
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Diary, getDiaries } from "../lib/diary";

export default function Index() {
  const router = useRouter();
  const navigation = useNavigation();
  const [diaries, setDiaries] = useState<Diary[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

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
      {item.title ? (
        <Text style={styles.diaryTitle} numberOfLines={1}>
          {item.title}
        </Text>
      ) : null}
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
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>日記がありません</Text>
        }
      />

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => router.push("/settings")}
      >
        <Ionicons name="settings-outline" size={24} color="#007AFF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/diaries/new")}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  listContent: {
    paddingTop: 60,
    paddingBottom: 100,
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
  diaryTitle: {
    fontSize: 16,
    fontWeight: "600",
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
  settingsButton: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    position: "absolute",
    bottom: 32,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
