/**
 * MatchPopup — Full-screen overlay when unanimous match is found.
 */

import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';

interface Props {
  restaurant: RestaurantCard;
  onDismiss: () => void;
}

const MatchPopup = ({restaurant, onDismiss}: Props) => {
  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>It's a Match!</Text>
          <Text style={styles.subtitle}>Everyone agreed on</Text>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.category}>{restaurant.category}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Continue to results">
            <Text style={styles.buttonText}>See Results →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: '85%',
  },
  emoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#999',
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default MatchPopup;
