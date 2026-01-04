import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getEntryByDate } from "../lib/entry";
import { formatDate } from "../lib/format";

export default function TodayRedirect() {
  const router = useRouter();

  useEffect(() => {
    const redirect = async () => {
      const today = formatDate(new Date());
      const entry = await getEntryByDate(today);
      if (entry) {
        router.replace(`/entries/${entry.id}`);
      } else {
        router.replace('/entries/new');
      }
    };
    redirect();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
