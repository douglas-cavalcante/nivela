import { setupServer } from 'msw/node';

/** Servidor MSW compartilhado: cada teste registra seus handlers com `server.use(...)`. */
export const server = setupServer();

export const API_URL = import.meta.env.VITE_API_URL;
