/**
 * MatchPopup — Full-screen overlay when unanimous match is found.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';
import {getRestaurantImageUri} from '@/constants/restaurantImages';
import AppIcon from './AppIcon';
import PhotoAttribution from './PhotoAttribution';
import DataAttribution from './DataAttribution';

interface Props {
  restaurant: RestaurantCard;
  onDismiss: () => void;
}

const MatchPopup = ({restaurant, onDismiss}: Props) => {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.close} onPress={onDismiss}>
          <AppIcon name="close" size={28} />
        </TouchableOpacity>
        <View style={styles.content}>
          <Text style={styles.title}>เลือกร้าน</Text>
          <View style={styles.photos}>
            <Image
              source={{uri: getRestaurantImageUri(restaurant)}}
              style={[styles.photo, styles.photoLeft]}
            />
            <Image
              source={{uri: getRestaurantImageUri(restaurant)}}
              style={[styles.photo, styles.photoRight]}
            />
          </View>
          <PhotoAttribution restaurant={restaurant} light />
          <DataAttribution source={restaurant.source} light />
          <Text style={styles.match}>ตรงกัน!</Text>
          <Text style={styles.subtitle}>ทุกคนเลือกร้าน {restaurant.name}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="ไปดูผลลัพธ์">
            <Text style={styles.buttonText}>ดูผลและตำแหน่งร้าน</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#790016',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FF1717',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#FFF',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  button: {
    borderWidth: 1,
    borderColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  close: {
    position: 'absolute',
    top: 55,
    left: 14,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photos: {width: 290, height: 245, marginTop: 2},
  photo: {
    position: 'absolute',
    width: 170,
    height: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  photoLeft: {left: 12, top: 5, transform: [{rotate: '-14deg'}]},
  photoRight: {right: 8, top: 20, transform: [{rotate: '12deg'}]},
  match: {
    fontSize: 62,
    lineHeight: 70,
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#FF1717',
  },
});

export default MatchPopup;
