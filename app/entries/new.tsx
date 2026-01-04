import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import EntryEditor from "../../components/EntryEditor";
import { getEntryByDate } from "../../lib/entry";
import { formatDate } from "../../lib/format";

export default function NewEntry() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkTodayEntry = async () => {
      const today = formatDate(new Date());
      const entry = await getEntryByDate(today);
      if (entry) {
        // Today's entry exists, redirect to it
        router.replace(`/entries/${entry.id}`);
      } else {
        setChecking(false);
      }
    };
    checkTodayEntry();
  }, [router]);

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <EntryEditor entryId={null} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
