// Regras de arquitetura (ver docs/estruturaDePastas.md):
// - imports que saem da pasta usam o alias src/..., nunca ../
// - uma feature (src/modules/<feature>) só usa outra pelo <feature>.module
//   ou por um service dela (*.service.ts, ex.: join-code.service)
// - o núcleo (common, shared, prisma) não depende de features
// - controllers não importam o PrismaService (acesso a dados fica no service)
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const root = dirname(fileURLToPath(import.meta.url));
const modulesDir = join(root, 'src', 'modules');
const features = existsSync(modulesDir)
  ? readdirSync(modulesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
const CORE = ['common', 'shared', 'prisma'];

const noParent = {
  group: ['../**', '..'],
  message: 'Use o alias src/... em vez de ../',
};

const noPrismaInControllers = {
  name: 'src/prisma/prisma.service',
  importNames: ['PrismaService'],
  message: 'Controllers não acessam o banco: use o service da feature.',
};

const otherFeatures = (feature) => ({
  group: [
    'src/modules/*/**',
    `!src/modules/${feature}/**`,
    '!src/modules/*/*.module',
    '!src/modules/*/*.service',
  ],
  message:
    'Outra feature só pelo <feature>.module ou <feature>.service dela (exporte o que precisar no módulo da feature).',
});

const coreNoFeatures = {
  group: ['src/modules/**'],
  message: 'O núcleo (common, shared, prisma) não pode depender de features.',
};

const restrict = ({ patterns = [], paths = [] } = {}) => ({
  'no-restricted-imports': [
    'error',
    { paths, patterns: [noParent, ...patterns] },
  ],
});

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'src/generated/**', 'jest/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: root,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      ...restrict(),
    },
  },
  ...CORE.map((dir) => ({
    files: [`src/${dir}/**/*.ts`],
    rules: restrict({ patterns: [coreNoFeatures] }),
  })),
  ...features.map((feature) => ({
    files: [`src/modules/${feature}/**/*.ts`],
    rules: restrict({ patterns: [otherFeatures(feature)] }),
  })),
  ...features.map((feature) => ({
    files: [`src/modules/${feature}/**/*.controller.ts`],
    rules: restrict({
      patterns: [otherFeatures(feature)],
      paths: [noPrismaInControllers],
    }),
  })),
);
