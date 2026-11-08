// Regras de arquitetura (ver docs/estruturaDePastas.md):
// - imports que saem da pasta usam o alias src/..., nunca ../
// - uma feature só usa outra pelo index.ts dela e não depende de src/app
// - código compartilhado (components, lib, hooks, utils...) não depende de features nem de app
// - chamadas HTTP (axios) só em features/<feature>/api/ e em src/lib/
// - sem `any` explícito e sem cor hexadecimal fora de src/lib/theme (use os tokens)
import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import fs from 'node:fs';
import tseslint from 'typescript-eslint';

const FILES = '**/*.{ts,tsx}';

const noParentImports = {
  regex: '^\\.\\./',
  message: 'Use o alias src/... em vez de ../ (imports ./ da mesma pasta são permitidos).',
};

const noHttpClient = ['axios', 'src/lib/axios'].map((name) => ({
  name,
  message: 'Chamadas HTTP ficam em features/<feature>/api/ (ver docs/estruturaDePastas.md).',
}));

const featuresDir = 'src/features';
const features = fs.existsSync(featuresDir)
  ? fs
      .readdirSync(featuresDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

// `http: false` libera o import do axios (usado em features/*/api e em lib/)
const restrict = (patterns = [], { http = true } = {}) => ({
  'no-restricted-imports': ['error', { paths: http ? noHttpClient : [], patterns: [noParentImports, ...patterns] }],
});

const featurePatterns = (feature) => [
  { regex: '^src/app(/|$)', message: 'Features não podem importar de src/app.' },
  {
    regex: `^src/features/(?!${feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/)[^/]+/`,
    message: 'Importe outras features só pelo index.ts delas: src/features/<nome>.',
  },
];

const sharedPattern = {
  regex: '^src/(features|app)(/|$)',
  message: 'Código compartilhado não pode depender de features nem de src/app.',
};

const HEX_COLOR = '#[0-9a-fA-F]{3,8}\\b';
const noHexColors = {
  'no-restricted-syntax': [
    'error',
    {
      selector: `Literal[value=/${HEX_COLOR}/]`,
      message: 'Cor hexadecimal fora do tema: use os tokens de @nivela/design-tokens (via tema MUI).',
    },
    {
      selector: `TemplateElement[value.raw=/${HEX_COLOR}/]`,
      message: 'Cor hexadecimal fora do tema: use os tokens de @nivela/design-tokens (via tema MUI).',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [`src/${FILES}`, 'vite.config.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2022 } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...restrict(),
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Cores só nos tokens e no tema MUI gerado a partir deles
    files: [`src/${FILES}`],
    ignores: ['src/lib/theme/**'],
    rules: noHexColors,
  },
  {
    files: ['components', 'constants', 'hooks', 'styles', 'types', 'utils', 'assets'].map((dir) => `src/${dir}/${FILES}`),
    rules: restrict([sharedPattern]),
  },
  {
    // src/test: infraestrutura dos testes (setup, MSW, render)
    files: [`src/lib/${FILES}`, `src/test/${FILES}`],
    rules: restrict([sharedPattern], { http: false }),
  },
  ...features.flatMap((feature) => [
    {
      files: [`src/features/${feature}/${FILES}`],
      ignores: [`src/features/${feature}/api/**`],
      rules: restrict(featurePatterns(feature)),
    },
    {
      files: [`src/features/${feature}/api/${FILES}`],
      rules: restrict(featurePatterns(feature), { http: false }),
    },
  ]),
);
