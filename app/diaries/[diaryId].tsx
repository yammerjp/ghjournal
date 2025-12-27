import { useLocalSearchParams } from "expo-router";
import DiaryEditor from "../../components/DiaryEditor";

export default function DiaryDetail() {
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  return <DiaryEditor diaryId={diaryId!} />;
}
