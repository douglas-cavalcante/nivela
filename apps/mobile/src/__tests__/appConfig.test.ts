import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brand } from '@nivela/design-tokens';

const root = process.cwd(); // o jest roda a partir de apps/mobile
const { expo } = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
  expo: {
    version: string;
    icon: string;
    android: {
      versionCode: number;
      adaptiveIcon: { foregroundImage: string; backgroundColor: string };
    };
    plugins: (string | [string, Record<string, unknown>])[];
  };
};

describe('configuração do build android', () => {
  it('libera tráfego HTTP (cleartext) para o servidor na rede local', () => {
    const plugin = expo.plugins.find(
      (item): item is [string, Record<string, unknown>] =>
        Array.isArray(item) && item[0] === 'expo-build-properties',
    );
    expect(plugin?.[1]).toMatchObject({ android: { usesCleartextTraffic: true } });
  });

  it('declara versão 1.0.0 e versionCode 1', () => {
    expect(expo.version).toBe('1.0.0');
    expect(expo.android.versionCode).toBe(1);
  });

  it('aponta para ícones que existem', () => {
    const splash = expo.plugins.find(
      (item): item is [string, { image: string; backgroundColor: string }] =>
        Array.isArray(item) && item[0] === 'expo-splash-screen',
    );
    const paths = [expo.icon, expo.android.adaptiveIcon.foregroundImage, splash?.[1].image];
    for (const path of paths) {
      expect(path).toBeDefined();
      expect(existsSync(join(root, path as string))).toBe(true);
    }
  });

  it('usa a cor do papel no fundo do ícone adaptativo e da splash', () => {
    const splash = expo.plugins.find(
      (item): item is [string, { backgroundColor: string }] =>
        Array.isArray(item) && item[0] === 'expo-splash-screen',
    );
    expect(expo.android.adaptiveIcon.backgroundColor).toBe(brand.paper);
    expect(splash?.[1].backgroundColor).toBe(brand.paper);
  });
});
