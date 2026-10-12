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
  /**
   * Triggers the system permission dialog and then fetches a fix. Called from
   * the button here rather than at startup, so the user always sees the reason
   * before the OS prompt appears (requirement 3.2, 3.3).
   */
  onRequestPermission: () => Promise<void>;
}

const PermissionGateScreen = ({onRequestPermission}: Props) => {
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
        await onRequestPermission();
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
        <Text style={styles.hint}>การตั้งค่า → สิทธิ์ → ตำแหน่ง → อนุญาต</Text>
      )}
    </View>
  );
};

function getCopy(isBlocked: boolean, isLocationFailure: boolean) {
  if (isBlocked) {
    return {
      title: 'ยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง',
      message:
        'Ginder ใช้ตำแหน่งเพื่อค้นหาร้านใกล้คุณ กรุณาเปิดสิทธิ์ในการตั้งค่าอุปกรณ์',
      buttonLabel: 'เปิดการตั้งค่า',
    };
  }

  if (isLocationFailure) {
    return {
      title: 'ยังค้นหาตำแหน่งไม่ได้',
      message:
        'ได้รับสิทธิ์แล้วแต่ยังค้นหาตำแหน่งไม่ได้ กรุณาเปิดบริการตำแหน่งของอุปกรณ์',
      buttonLabel: 'ลองอีกครั้ง',
    };
  }

  return {
    title: 'ต้องใช้ตำแหน่งเพื่อหาร้าน',
    message:
      'Ginder ใช้ตำแหน่งเพื่อค้นหาร้านใกล้คุณ กรุณาอนุญาตตำแหน่งขณะใช้แอป',
    buttonLabel: 'อนุญาตตำแหน่ง',
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
