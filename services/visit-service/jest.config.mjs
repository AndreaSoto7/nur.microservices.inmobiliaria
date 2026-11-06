import { createDefaultEsmPreset } from 'ts-jest';

export default {
  ...createDefaultEsmPreset({ tsconfig: 'tsconfig.test.json' }),
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  testEnvironment: 'node',
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
