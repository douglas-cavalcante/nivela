import { BrowserRouter } from 'react-router';
import { AppRoutes } from 'src/app/routes';
import { AuthProvider } from 'src/lib/auth/AuthContext';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { ColorModeProvider } from 'src/lib/theme/ColorModeProvider';

export function App() {
  return (
    <ColorModeProvider>
      <NotifyProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </NotifyProvider>
    </ColorModeProvider>
  );
}
