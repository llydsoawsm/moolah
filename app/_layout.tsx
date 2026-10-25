// ============================================================
// MoneyGuide — Root Layout
// ============================================================
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { initializeDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import { useTheme } from '../hooks/useTheme';
import LockScreen from '../components/auth/LockScreen';
import AuthScreen from '../components/auth/AuthScreen';
import 'react-native-reanimated';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setDbReady = useAppStore((s) => s.setDbReady);
  const loadPreferences = useAppStore((s) => s.loadPreferences);
  const isUnlocked = useAppStore((s) => s.isUnlocked);
  const currentUser = useAppStore((s) => s.currentUser);
  const { colors } = useTheme();

  useEffect(() => {
    async function init() {
      try {
        // Initialize database & seed defaults
        initializeDatabase();
        setDbReady(true);

        // Load user preferences (theme, PIN, user session, etc.)
        await loadPreferences();
      } catch (e) {
        console.error('Failed to initialize:', e);
      } finally {
        setReady(true);
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  if (!ready) {
    return null;
  }

  // 1. User Authentication Guard
  if (!currentUser) {
    return (
      <>
        <StatusBar style={colors.statusBar} />
        <AuthScreen />
      </>
    );
  }

  // 2. PIN / Biometric App Lock Guard
  if (!isUnlocked) {
    return (
      <>
        <StatusBar style={colors.statusBar} />
        <LockScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(modals)/category-picker"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="(modals)/expense-detail"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="(modals)/budget-manager"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="(modals)/recurring-manager"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="(modals)/ai-copilot"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="(modals)/receipt-viewer"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
      </Stack>
    </>
  );
}
