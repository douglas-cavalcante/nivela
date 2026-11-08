import { Caveat_700Bold } from '@expo-google-fonts/caveat/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { OfflineScreen } from 'src/components/OfflineScreen';
import { AuthProvider, useAuth } from 'src/lib/auth/AuthContext';
import { ThemeProvider } from 'src/lib/theme/ThemeProvider';
import { useTheme } from 'src/lib/theme/useTheme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading, offline, retrying, retry } = useAuth();
  const { mode } = useTheme();

  // A splash fica até validar o token salvo, para não piscar a tela de entrada.
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  // Sessão salva, mas a API não respondeu: mantém o token e oferece tentar de novo.
  if (offline) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OfflineScreen onRetry={retry} retrying={retrying} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!user} redirectTo="/welcome">
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!user} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Caveat_700Bold, Nunito_400Regular, Nunito_700Bold });

  // Se uma fonte falhar, o app abre com as fontes do sistema em vez de ficar preso na splash.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
