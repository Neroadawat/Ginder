/**
 * Explore Categories Screen — Browse restaurant categories.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useCategories} from '@/hooks/useRestaurants';
import {getCategoryEmoji} from '@/constants/placeholders';
import {ExploreStackParamList} from '@/navigation/types';
import {COLORS} from '@/constants/theme';

type NavigationProp = NativeStackNavigationProp<
  ExploreStackParamList,
  'ExploreCategories'
>;

const ExploreCategoriesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {data: categories, isLoading} = useCategories();

  const renderCategory = ({item}: {item: string}) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => navigation.navigate('CategoryResults', {category: item})}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${item} restaurants`}>
      <Text style={styles.categoryEmoji}>{getCategoryEmoji(item)}</Text>
      <Text style={styles.categoryName}>{item}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>
          Find restaurant in category that you want
        </Text>
      </View>

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={item => item}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: 58,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: '#E5E1E1',
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 2,
    paddingBottom: 92,
  },
  row: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    flex: 1,
    height: 226,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 17,
    padding: 14,
    margin: 5,
    justifyContent: 'space-between',
  },
  categoryEmoji: {
    fontSize: 78,
    textAlign: 'center',
    marginTop: 54,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ExploreCategoriesScreen;
