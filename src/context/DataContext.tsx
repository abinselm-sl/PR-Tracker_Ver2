import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {PurchaseRequisition, PRItem} from '../types';
import DatabaseService from '../services/DatabaseService';
import SyncService from '../services/SyncService';
import {useAuth} from './AuthContext';

interface DataContextType {
  purchaseRequisitions: PurchaseRequisition[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  updateItem: (prId: string, itemId: string, updates: Partial<PRItem>) => Promise<void>;
  deletePR: (prId: string) => Promise<void>;
  addPR: (pr: PurchaseRequisition) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({children}) => {
  const [purchaseRequisitions, setPurchaseRequisitions] = useState<PurchaseRequisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {user} = useAuth();

  useEffect(() => {
    if (user) {
      initializeData();
    }
  }, [user]);

  const initializeData = async () => {
    try {
      setIsLoading(true);
      await DatabaseService.initializeDatabase();
      await refreshData();
      // Start sync process
      SyncService.startPeriodicSync();
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const prs = await DatabaseService.getAllPRs();
      setPurchaseRequisitions(prs);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const updateItem = async (prId: string, itemId: string, updates: Partial<PRItem>) => {
    try {
      await DatabaseService.updatePRItem(prId, itemId, updates, user?.userName || '');
      await refreshData();
      // Queue for sync
      SyncService.queueUpdate('item', {prId, itemId, updates});
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const deletePR = async (prId: string) => {
    try {
      await DatabaseService.deletePR(prId);
      await refreshData();
      // Queue for sync
      SyncService.queueUpdate('delete_pr', {prId});
    } catch (error) {
      console.error('Error deleting PR:', error);
    }
  };

  const addPR = async (pr: PurchaseRequisition) => {
    try {
      await DatabaseService.addPR(pr);
      await refreshData();
      // Queue for sync
      SyncService.queueUpdate('add_pr', {pr});
    } catch (error) {
      console.error('Error adding PR:', error);
    }
  };

  return (
    <DataContext.Provider
      value={{
        purchaseRequisitions,
        isLoading,
        refreshData,
        updateItem,
        deletePR,
        addPR,
      }}>
      {children}
    </DataContext.Provider>
  );
};