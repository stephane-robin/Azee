import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View, Image, Text } from 'react-native';
import { initDatabase } from '../database/db';
import { couleurFond, bleuPrincipal, bleuSecondaire, transparent, grisIntermediaire, grisSombre, grisClair } from '../constants/colors';

export default function Layout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => console.error("Erreur d'init SQLite :", err));
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={bleuPrincipal} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: couleurFond }, 
        headerStyle: { backgroundColor: bleuPrincipal },  
        headerTintColor: '#fff',                   
        headerTitleAlign: 'center',
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image 
              source={require('../../assets/images/symbole192-192.png')} 
              style={{ width: 28, height: 28, marginRight: 10, resizeMode: 'contain' }} 
            />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
              Mes Docs
            </Text>
          </View>
        ),
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-medication" options={{ presentation: 'modal'}} />
    </Stack>
  );
}
