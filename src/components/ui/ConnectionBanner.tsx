import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { colors, radius, shadows, spacing } from '../../theme/tokens';

interface ConnectionBannerProps {
  bottomOffset: number;
}

/**
 * Persistent connection/sync error banner shown across all tabs until server sync is restored.
 */
export function ConnectionBanner({ bottomOffset }: ConnectionBannerProps) {
  const { session, isOffline, syncStatus, syncError, retrySync } = useKiddoMed();

  const shouldShow = Boolean(session) && (isOffline || syncStatus === 'error' || Boolean(syncError));
  if (!shouldShow) {
    return null;
  }

  const isError = syncStatus === 'error';
  const isConnecting = syncStatus === 'connecting';
  const bg = isError ? colors.dangerSoft : colors.warningSoft;
  const border = isError ? colors.danger : colors.warning;
  const textColor = isError ? colors.dangerText : colors.warningText;
  const message =
    syncError ??
    (isConnecting
      ? 'Reconectando con el servidor...'
      : 'Sin conexión a internet. Esperando reconexión...');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: bottomOffset }]}
    >
      <View
        style={[
          styles.banner,
          {
            backgroundColor: bg,
            borderColor: border,
          },
        ]}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Ionicons
            name={isError ? 'alert-circle' : 'cloud-offline'}
            size={18}
            color={textColor}
          />
        )}
        <Text style={[styles.text, { color: textColor }]} numberOfLines={2}>
          {message}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            retrySync();
          }}
          style={({ pressed }) => [
            styles.retryBtn,
            { borderColor: border },
            pressed && styles.retryBtnPressed,
          ]}
          hitSlop={8}
        >
          <Text style={[styles.retryText, { color: textColor }]}>Reintentar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    ...shadows.card,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  retryBtnPressed: {
    opacity: 0.7,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
