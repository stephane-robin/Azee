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
        headerShown: false,                             
        contentStyle: { backgroundColor: couleurFond }, 
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-medication" options={{ presentation: 'modal'}} />
    </Stack>
  );
}
