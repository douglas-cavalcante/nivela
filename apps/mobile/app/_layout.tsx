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
  const { user, loading, offline, offlineStatus, retrying, retry, signOut } = useAuth();
  const { mode } = useTheme();

  // A splash fica até validar o token salvo, para não piscar a tela de entrada.
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  // Sessão salva, mas a checagem falhou (sem resposta, 5xx, 403/404/429): mantém o token e oferece tentar de novo ou sair.
  if (offline) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OfflineScreen status={offlineStatus} onRetry={retry} onSignOut={() => void signOut()} retrying={retrying} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!user} redirectTo="/welcome">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="practice/[subjectId]" />
          <Stack.Screen name="store/redemptions" />
          <Stack.Screen name="plans/[id]" />
          <Stack.Screen name="plans/[id]/chapters/[chapterId]" />
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
