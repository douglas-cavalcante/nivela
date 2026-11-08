import * as SecureStore from 'expo-secure-store';

const KEY = 'nivela.token';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    // sem armazenamento seguro a sessão não sobrevive ao fechar o app
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // nada a limpar
  }
}
