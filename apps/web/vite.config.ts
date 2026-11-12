import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { src: fileURLToPath(new URL('./src', import.meta.url)) },
    // uma única cópia do React, mesmo depois de o Vite reotimizar dependências
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // pré-otimiza tudo de uma vez: evita reotimização tardia (e "Invalid hook call") ao abrir uma página nova
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@mui/material',
      '@mui/material/styles',
      '@mui/icons-material/Add',
      '@mui/icons-material/AddPhotoAlternateOutlined',
      '@mui/icons-material/BadgeOutlined',
      '@mui/icons-material/BlockOutlined',
      '@mui/icons-material/Calculate',
      '@mui/icons-material/CategoryOutlined',
      '@mui/icons-material/CheckCircleOutlined',
      '@mui/icons-material/DarkModeOutlined',
      '@mui/icons-material/DeleteOutlined',
      '@mui/icons-material/EditOutlined',
      '@mui/icons-material/GroupsOutlined',
      '@mui/icons-material/HelpOutlineOutlined',
      '@mui/icons-material/HomeOutlined',
      '@mui/icons-material/ImageOutlined',
      '@mui/icons-material/LightModeOutlined',
      '@mui/icons-material/LockResetOutlined',
      '@mui/icons-material/LogoutOutlined',
      '@mui/icons-material/Menu',
      '@mui/icons-material/MenuBook',
      '@mui/icons-material/MenuBookOutlined',
      '@mui/icons-material/Palette',
      '@mui/icons-material/PeopleAltOutlined',
      '@mui/icons-material/Public',
      '@mui/icons-material/SchoolOutlined',
      '@mui/icons-material/Science',
      '@mui/icons-material/Search',
      '@mui/icons-material/StorefrontOutlined',
      '@mui/icons-material/SwapHorizOutlined',
      '@mui/icons-material/Translate',
      '@mui/icons-material/VisibilityOffOutlined',
      '@mui/icons-material/VisibilityOutlined',
    ],
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    // mesma origem da API: o XHR do jsdom não faz preflight de CORS nos testes com MSW
    environmentOptions: { jsdom: { url: 'http://localhost:8000' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: { VITE_API_URL: 'http://localhost:8000/api/v1' },
  },
});
