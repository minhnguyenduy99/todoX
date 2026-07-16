module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@todo-platform/shared-types$': '<rootDir>/../../../packages/shared-types/src/index.ts',
    '^@todo-platform/shared-api$': '<rootDir>/../../../packages/shared-api/src/index.ts',
  },
};
