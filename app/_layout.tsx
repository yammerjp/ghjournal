import "react-native-get-random-values"; // Must be first for crypto polyfill
import "../lib/i18n"; // Initialize i18n
import { useEffect, useState, useCallback } from "react";
import { Stack, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
import { initDatabase } from "../lib/database";
import { SyncProvider } from "../contexts/SyncContext";
import { getEntryByDate } from "../lib/entry";
import { formatDate } from "../lib/format";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  const handleDeepLink = useCallback(async (url: string) => {
    const path = url.replace(/^ghjournal:\/\//, '');

    if (path === 'today' || path === '') {
      const today = formatDate(new Date());
      const entry = await getEntryByDate(today);
      if (entry) {
        router.push(`/entries/${entry.id}`);
      } else {
        router.push('/entries/new');
      }
    }
  }, [router]);

  useEffect(() => {
    initDatabase().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle app launch with URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [isReady, handleDeepLink]);

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="entries/new" options={{ title: t('entry.new'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="entries/[entryId]" options={{ title: "ghjournal", headerBackTitle: t('common.back') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="debug-logs" options={{ title: t('debugLogs.title'), headerBackTitle: t('common.back') }} />
      </Stack>
    </SyncProvider>
  );
}
