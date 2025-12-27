import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { initDatabase } from "../lib/database";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initDatabase().then(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "日記" }} />
      <Stack.Screen name="diaries/new" options={{ title: "新規作成" }} />
      <Stack.Screen name="diaries/[diaryId]" options={{ title: "日記" }} />
    </Stack>
  );
}
