import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {Provider as PaperProvider} from 'react-native-paper';
import {StatusBar, Alert} from 'react-native';
import NetInfo from '@react-native-net-info';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import PRDetailsScreen from './screens/PRDetailsScreen';
import SettingsScreen from './screens/SettingsScreen';
import {AuthProvider, useAuth} from './context/AuthContext';
import {DataProvider} from './context/DataContext';
import {NetworkProvider} from './context/NetworkContext';
import SyncService from './services/SyncService';
import theme from './theme';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const {user, isLoading} = useAuth();

  if (isLoading) {
    return null; // Show loading screen
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {user ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="PRDetails" component={PRDetailsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};

const App = () => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      if (state.isConnected) {
        SyncService.syncData();
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isConnected) {
      Alert.alert(
        'No Internet Connection',
        'You are currently offline. Some features may not be available.',
        [{text: 'OK'}]
      );
    }
  }, [isConnected]);

  return (
    <PaperProvider theme={theme}>
      <NetworkProvider>
        <AuthProvider>
          <DataProvider>
            <NavigationContainer>
              <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
              <AppNavigator />
            </NavigationContainer>
          </DataProvider>
        </AuthProvider>
      </NetworkProvider>
    </PaperProvider>
  );
};

export default App;