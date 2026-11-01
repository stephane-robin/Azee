import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View, Image, Text } from 'react-native';
import { initDatabase } from '../database/db';
import { couleurFond, bleuPrincipal, bleuSecondaire, transparent, grisIntermediaire, grisSombre, grisClair } from '../constants/colors';
import * as SplashScreen from 'expo-splash-screen';

// Empêche le splash screen de se masquer automatiquement tout de suite
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function prepareApp() {
      try {
        await Promise.all([
          initDatabase(),
          new Promise(resolve => setTimeout(resolve, 2000)) // 2000 ms = 2 secondes minimum
        ]);
        setDbReady(true);
}catch(err) { console.error("Erreur d'init SQLite :", err);
}
finally {
  await SplashScreen.hideAsync(); 
}
    }
  prepareApp();
}, []);

  if (!dbReady) {
    return null;
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
