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
import {ExploreStackParamList} from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<ExploreStackParamList, 'ExploreCategories'>;

const CATEGORY_EMOJIS: Record<string, string> = {
  Thai: '🇹🇭',
  Japanese: '🇯🇵',
  Korean: '🇰🇷',
  'Fast Food': '🍔',
  Cafe: '☕',
  Dessert: '🍰',
  Italian: '🍝',
  Chinese: '🥟',
};

const ExploreCategoriesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {data: categories, isLoading} = useCategories();

  const renderCategory = ({item}: {item: string}) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => navigation.navigate('CategoryResults', {category: item})}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${item} restaurants`}>
      <Text style={styles.categoryEmoji}>
        {CATEGORY_EMOJIS[item] || '🍽️'}
      </Text>
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
        <Text style={styles.subtitle}>Browse by category</Text>
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  list: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    margin: 6,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ExploreCategoriesScreen;
