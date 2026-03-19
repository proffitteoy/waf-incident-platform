module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/../test/backend"],
  testMatch: ["**/*.test.[jt]s"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleDirectories: ["node_modules", "<rootDir>/node_modules"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }]
  },
  setupFilesAfterEnv: ["<rootDir>/../test/backend/jest.setup.ts"],
  testPathIgnorePatterns: ["/dist/"]
};
