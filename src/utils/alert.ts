import { Alert, AlertButton, AlertOptions, Platform } from 'react-native';

/**
 * Cross-platform alert helper.
 * On native, delegates directly to `Alert.alert`.
 * On web (where `Alert.alert` is a no-op in react-native-web), uses `window.confirm`
 * for multi-button confirmation dialogs and `window.alert` for informational alerts.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }

  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmButton =
    buttons.find((b) => b.style === 'destructive') ??
    buttons.find((b) => b.style !== 'cancel') ??
    buttons[buttons.length - 1];

  const confirmed = window.confirm(text);
  if (confirmed) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
