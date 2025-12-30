import { useLocalSearchParams } from "expo-router";
import EntryEditor from "../../components/EntryEditor";

export default function EntryDetail() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <EntryEditor entryId={entryId!} />;
}
