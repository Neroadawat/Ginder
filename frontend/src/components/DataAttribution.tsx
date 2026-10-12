import React from 'react';
import {Linking, StyleSheet, Text} from 'react-native';

const DataAttribution = ({
  source,
  light = false,
}: {
  source: string;
  light?: boolean;
}) => {
  if (source !== 'osm') {
    return null;
  }
  return (
    <Text
      style={[styles.credit, light && styles.light]}
      accessibilityRole="link"
      onPress={() =>
        Linking.openURL('https://www.openstreetmap.org/copyright')
      }>
      © OpenStreetMap contributors
    </Text>
  );
};

const styles = StyleSheet.create({
  credit: {
    fontSize: 10,
    color: '#666',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  light: {color: '#EEE'},
});
export default DataAttribution;
