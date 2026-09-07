/**
 * Friend List Screen — View and search friends, unfriend.
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useFriends, useSearchFriends, useUnfriend} from '@/hooks/useFriends';

const FriendListScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const {data: friends, isLoading} = useFriends();
  const {data: searchResults} = useSearchFriends(searchQuery);
  const unfriendMutation = useUnfriend();

  const displayList = searchQuery ? searchResults?.friends : friends?.friends;

  const handleUnfriend = (friendId: string, name: string) => {
    Alert.alert('Unfriend', `Remove ${name} from your friends?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Unfriend',
        style: 'destructive',
        onPress: () => unfriendMutation.mutate(friendId),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.count}>{friends?.total ?? 0} friends</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search friends..."
        placeholderTextColor="#999"
        value={searchQuery}
        onChangeText={setSearchQuery}
        accessibilityLabel="Search friends"
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      ) : (
        <FlatList
          data={displayList ?? []}
          renderItem={({item}) => (
            <View style={styles.friendItem}>
              <View style={styles.friendAvatar}>
                <Text style={styles.friendAvatarText}>
                  {item.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.display_name}</Text>
                <Text style={styles.friendEmail}>{item.email}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleUnfriend(item.id, item.display_name)}
                accessibilityRole="button"
                accessibilityLabel={`Unfriend ${item.display_name}`}>
                <Text style={styles.unfriendText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No friends found' : 'No friends yet'}
              </Text>
            </View>
          }
        />
      )}
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
  backText: {
    fontSize: 16,
    color: '#FF6B6B',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  searchInput: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF',
    fontSize: 16,
    color: '#333',
  },
  list: {
    paddingHorizontal: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  friendEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  unfriendText: {
    fontSize: 14,
    color: '#E53E3E',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default FriendListScreen;
