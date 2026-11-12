import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Os aliases (src/*) ficam no tsconfig.json: são lidos de lá, sem duplicar.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  // Os pacotes @nestjs/* são só ESM e o Jest roda em CommonJS (Node 22):
  // jest/esm-transformer.js os converte para CommonJS.
  transform: {
    '[\\\\/]node_modules[\\\\/]@nestjs[\\\\/].+\\.js$':
      '<rootDir>/jest/esm-transformer.js',
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  transformIgnorePatterns: ['[\\\\/]node_modules[\\\\/](?!@nestjs[\\\\/])'],
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
