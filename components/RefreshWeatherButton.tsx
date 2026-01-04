import { useState, useEffect, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

const COOLDOWN_MS = 10000;

interface Props {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export default function RefreshWeatherButton({ onRefresh, disabled }: Props) {
  const { t } = useTranslation();
  const [inCooldown, setInCooldown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlePress = async () => {
    if (inCooldown || disabled || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }

    setInCooldown(true);
    timeoutRef.current = setTimeout(() => {
      setInCooldown(false);
    }, COOLDOWN_MS);
  };

  const isDisabled = disabled || inCooldown || isRefreshing;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      <Text style={[styles.buttonText, isDisabled && styles.buttonTextDisabled]}>
        {t('entry.refresh')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonTextDisabled: {
    color: "#999",
  },
});
