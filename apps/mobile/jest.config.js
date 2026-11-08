module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
