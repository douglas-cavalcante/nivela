import { BrowserRouter } from 'react-router';
import { AppRoutes } from 'src/app/routes';
import { AuthProvider } from 'src/lib/auth/AuthContext';
import { ColorModeProvider } from 'src/lib/theme/ColorModeProvider';

export function App() {
  return (
    <ColorModeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ColorModeProvider>
  );
}
