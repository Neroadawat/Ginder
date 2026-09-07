/**
 * Permission Gate — blocks the app until location access is granted.
 *
 * Requirement 2.8: location is mandatory. If the user denies it they cannot
 * use the app and must grant it to continue. The recovery action depends on
 * whether the permission was merely denied or permanently blocked.
 */

import React, {useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {getCurrentLocation, openAppSettings} from '@/services/location';
import {useLocationStore} from '@/stores/locationStore';

interface Props {
  /** Re-runs the permission request and location fetch. */
  onRetry: () => Promise<void>;
}

const PermissionGateScreen = ({onRetry}: Props) => {
  const permissionStatus = useLocationStore(state => state.permissionStatus);
  const error = useLocationStore(state => state.error);
  const isLocating = useLocationStore(state => state.isLocating);
  const [isBusy, setIsBusy] = useState(false);

  const isBlocked = permissionStatus === 'blocked';
  // Permission is fine but we still have no coordinates (GPS off, timeout).
  const isLocationFailure = permissionStatus === 'granted';

  const handlePrimaryAction = async () => {
    setIsBusy(true);
    try {
      if (isBlocked) {
        await openAppSettings();
      } else if (isLocationFailure) {
        await getCurrentLocation();
      } else {
        await onRetry();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const {title, message, buttonLabel} = getCopy(isBlocked, isLocationFailure);
  const busy = isBusy || isLocating;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={handlePrimaryAction}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}>
        {busy ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>

      {isBlocked && (
        <Text style={styles.hint}>
          Settings → Permissions → Location → Allow
        </Text>
      )}
    </View>
  );
};

function getCopy(isBlocked: boolean, isLocationFailure: boolean) {
  if (isBlocked) {
    return {
      title: 'Location access is blocked',
      message:
        'Ginder needs your location to find restaurants near you. Please enable it in your device settings to continue.',
      buttonLabel: 'Open Settings',
    };
  }

  if (isLocationFailure) {
    return {
      title: "Can't find your location",
      message:
        'Ginder has permission but could not get a GPS fix. Make sure location services are turned on.',
      buttonLabel: 'Try Again',
    };
  }

  return {
    title: 'Location required',
    message:
      'Ginder finds restaurants around you, so it needs access to your location to work.',
    buttonLabel: 'Allow Location',
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  error: {
    fontSize: 14,
    color: '#E53E3E',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default PermissionGateScreen;
