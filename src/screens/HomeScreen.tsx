import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Appbar,
  FAB,
  Searchbar,
  Card,
  Title,
  Paragraph,
  Chip,
  Badge,
  ActivityIndicator,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';

import {useAuth} from '../context/AuthContext';
import {useData} from '../context/DataContext';
import {useNetwork} from '../context/NetworkContext';
import {PurchaseRequisition, PRStatus, UserRole} from '../types';
import SyncService from '../services/SyncService';
import FileParserService from '../services/FileParserService';

const HomeScreen = () => {
  const navigation = useNavigation();
  const {user, logout} = useAuth();
  const {purchaseRequisitions, isLoading, refreshData, addPR} = useData();
  const {isConnected} = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPRs, setFilteredPRs] = useState<PurchaseRequisition[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    filterPRs();
  }, [purchaseRequisitions, searchQuery]);

  const filterPRs = () => {
    let filtered = purchaseRequisitions;
    
    if (searchQuery.trim()) {
      filtered = purchaseRequisitions.filter(pr =>
        pr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.items.some(item =>
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    setFilteredPRs(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      if (isConnected) {
        await SyncService.forceSyncNow();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUploadFile = async () => {
    if (user?.role === UserRole.Viewer) {
      Alert.alert('Access Denied', 'You do not have permission to upload files');
      return;
    }

    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.xlsx, DocumentPicker.types.xls],
      });

      const pr = await FileParserService.parseExcelFile(result);
      await addPR(pr);
      
      Alert.alert('Success', 'Purchase requisition uploaded successfully');
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Error', 'Failed to upload file');
      }
    }
  };

  const getPRStatusColor = (status: PRStatus) => {
    return status === PRStatus.Completed ? '#4CAF50' : '#FF9800';
  };

  const getPendingItemsCount = (pr: PurchaseRequisition) => {
    return pr.items.filter(item => !item.isComplete).length;
  };

  const renderPRItem = ({item}: {item: PurchaseRequisition}) => {
    const pendingCount = getPendingItemsCount(item);
    
    return (
      <Card
        style={styles.prCard}
        onPress={() => navigation.navigate('PRDetails', {prId: item.id})}>
        <Card.Content>
          <View style={styles.prHeader}>
            <Title style={styles.prTitle} numberOfLines={1}>
              {item.name}
            </Title>
            <Chip
              mode="outlined"
              textStyle={{color: getPRStatusColor(item.status)}}
              style={{borderColor: getPRStatusColor(item.status)}}>
              {item.status}
            </Chip>
          </View>
          
          <Paragraph style={styles.prDate}>
            Issue Date: {item.issueDate}
          </Paragraph>
          
          <View style={styles.prStats}>
            <View style={styles.statItem}>
              <Paragraph style={styles.statLabel}>Total Items</Paragraph>
              <Badge style={styles.statBadge}>{item.items.length}</Badge>
            </View>
            
            {pendingCount > 0 && (
              <View style={styles.statItem}>
                <Paragraph style={styles.statLabel}>Pending</Paragraph>
                <Badge style={[styles.statBadge, styles.pendingBadge]}>
                  {pendingCount}
                </Badge>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="PR Tracker" />
        <Appbar.Action
          icon={isConnected ? 'wifi' : 'wifi-off'}
          onPress={() => {}}
        />
        <Appbar.Action
          icon="account-settings"
          onPress={() => navigation.navigate('Settings')}
        />
        <Appbar.Action icon="logout" onPress={logout} />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Search PRs or items..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <FlatList
          data={filteredPRs}
          renderItem={renderPRItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Paragraph>No purchase requisitions found</Paragraph>
            </View>
          }
        />
      </View>

      {user?.role === UserRole.Admin && (
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={handleUploadFile}
          label="Upload PR"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchbar: {
    margin: 16,
    elevation: 2,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  prCard: {
    marginBottom: 12,
    elevation: 2,
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  prTitle: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  prDate: {
    color: '#666',
    fontSize: 12,
    marginBottom: 8,
  },
  prStats: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  statBadge: {
    backgroundColor: '#2196F3',
  },
  pendingBadge: {
    backgroundColor: '#FF9800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default HomeScreen;