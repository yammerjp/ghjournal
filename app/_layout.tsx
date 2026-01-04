import "react-native-get-random-values"; // Must be first for crypto polyfill
import "../lib/i18n"; // Initialize i18n
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { initDatabase } from "../lib/database";
import { SyncProvider } from "../contexts/SyncContext";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { t } = useTranslation();

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
    <SyncProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="entries/new" options={{ title: t('entry.new') }} />
        <Stack.Screen name="entries/[entryId]" options={{ title: "ghjournal" }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="debug-logs" options={{ title: t('debugLogs.title') }} />
      </Stack>
    </SyncProvider>
  );
}
