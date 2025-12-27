import { useEffect, useRef, useState, useCallback } from 'react';
import { Location, Weather, saveDraft } from '../lib/diary';

const DEBOUNCE_MS = 500;

export interface UseDiaryAutoSaveProps {
  initialId: string | null;
  title: string;
  date: Date;
  content: string;
  location: Location | null;
  weather: Weather | null;
  enabled: boolean;
}

interface UseDiaryAutoSaveResult {
  diaryId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isSaving: boolean;
  setCreatedAt: (value: string | null) => void;
  setUpdatedAt: (value: string | null) => void;
}

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const generateTitle = (content: string): string => {
  if (!content.trim()) return '';
  const firstLine = content.split('\n')[0].trim();
  return firstLine.slice(0, 20) + (firstLine.length > 20 ? '...' : '');
};

export function useDiaryAutoSave({
  initialId,
  title,
  date,
  content,
  location,
  weather,
  enabled,
}: UseDiaryAutoSaveProps): UseDiaryAutoSaveResult {
  const [diaryId, setDiaryId] = useState<string | null>(initialId);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{
    title: string;
    date: string;
    content: string;
    location: Location | null;
    weather: Weather | null;
  } | null>(null);

  const performSave = useCallback(async () => {
    const currentTitle = title.trim() || generateTitle(content);
    const currentDate = formatDate(date);
    const currentContent = content.trim();

    // For existing diary just loaded, initialize lastSaved and skip save
    if (diaryId && !lastSavedRef.current) {
      lastSavedRef.current = {
        title: currentTitle,
        date: currentDate,
        content: currentContent,
        location,
        weather,
      };
      return;
    }

    // Check if anything changed from last save
    const lastSaved = lastSavedRef.current;
    if (lastSaved) {
      const hasChanges =
        lastSaved.title !== currentTitle ||
        lastSaved.date !== currentDate ||
        lastSaved.content !== currentContent ||
        lastSaved.location?.latitude !== location?.latitude ||
        lastSaved.location?.longitude !== location?.longitude ||
        lastSaved.weather?.wmoCode !== weather?.wmoCode ||
        lastSaved.weather?.temperatureMin !== weather?.temperatureMin ||
        lastSaved.weather?.temperatureMax !== weather?.temperatureMax;

      if (!hasChanges) return;
    }

    setIsSaving(true);

    try {
      const result = await saveDraft({
        diaryId,
        title: currentTitle,
        date: currentDate,
        content: currentContent,
        location: location ?? undefined,
        weather: weather ?? undefined,
      });

      setDiaryId(result.diaryId);
      setCreatedAt(result.createdAt);
      setUpdatedAt(result.updatedAt);

      // Update last saved state
      lastSavedRef.current = {
        title: currentTitle,
        date: currentDate,
        content: currentContent,
        location,
        weather,
      };
    } finally {
      setIsSaving(false);
    }
  }, [title, date, content, location, weather, diaryId]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, title, date, content, location, weather, performSave]);

  return {
    diaryId,
    createdAt,
    updatedAt,
    isSaving,
    setCreatedAt,
    setUpdatedAt,
  };
}
