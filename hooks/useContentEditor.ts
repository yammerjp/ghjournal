import { useState, useRef, useCallback } from 'react';
import { TextInput } from 'react-native';

const DOUBLE_TAP_DELAY = 300;
const PADDING_TOP = 16;
const PADDING_HORIZONTAL = 16;
const LINE_HEIGHT = 24;
const CHAR_WIDTH = 9; // Approximate width for 16px font

interface UseContentEditorProps {
  content: string;
  isNewAndEmpty: boolean;
}

interface UseContentEditorResult {
  isEditing: boolean;
  selection: { start: number; end: number } | undefined;
  showTextInput: boolean;
  contentInputRef: React.RefObject<TextInput | null>;
  handleTap: (locationX: number, locationY: number) => void;
  enterEditMode: (cursorPosition: number) => void;
  exitEditMode: () => void;
  onSelectionApplied: () => void;
  focusInput: () => void;
}

export function useContentEditor({
  content,
  isNewAndEmpty,
}: UseContentEditorProps): UseContentEditorResult {
  const [isEditing, setIsEditing] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  const contentInputRef = useRef<TextInput>(null);
  const lastTapRef = useRef<number>(0);
  const pendingSelectionRef = useRef<number | null>(null);

  const showTextInput = isEditing || isNewAndEmpty;

  const calculateCursorPosition = useCallback((locationX: number, locationY: number): number => {
    const line = Math.max(0, Math.floor((locationY - PADDING_TOP) / LINE_HEIGHT));
    const col = Math.max(0, Math.floor((locationX - PADDING_HORIZONTAL) / CHAR_WIDTH));

    const lines = content.split('\n');
    let charIndex = 0;
    for (let i = 0; i < Math.min(line, lines.length); i++) {
      charIndex += lines[i].length + 1; // +1 for newline
    }
    if (line < lines.length) {
      charIndex += Math.min(col, lines[line].length);
    } else {
      charIndex = content.length;
    }

    return charIndex;
  }, [content]);

  const enterEditMode = useCallback((cursorPosition: number) => {
    pendingSelectionRef.current = cursorPosition;
    setIsEditing(true);

    // Apply selection after a short delay to let TextInput mount
    setTimeout(() => {
      if (pendingSelectionRef.current !== null) {
        setSelection({ start: pendingSelectionRef.current, end: pendingSelectionRef.current });
        pendingSelectionRef.current = null;
      }
    }, 50);
  }, []);

  const handleTap = useCallback((locationX: number, locationY: number) => {
    const now = Date.now();

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const cursorPosition = calculateCursorPosition(locationX, locationY);
      enterEditMode(cursorPosition);
    }
    lastTapRef.current = now;
  }, [calculateCursorPosition, enterEditMode]);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setSelection(undefined);
    pendingSelectionRef.current = null;
  }, []);

  const onSelectionApplied = useCallback(() => {
    if (selection !== undefined) {
      setTimeout(() => setSelection(undefined), 0);
    }
  }, [selection]);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      contentInputRef.current?.focus();
    }, 50);
  }, []);

  return {
    isEditing,
    selection,
    showTextInput,
    contentInputRef,
    handleTap,
    enterEditMode,
    exitEditMode,
    onSelectionApplied,
    focusInput,
  };
}
