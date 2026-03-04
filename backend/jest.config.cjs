module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests", "<rootDir>/tests-layered"],
  testMatch: ["**/*.test.[jt]s"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }]
  },
  setupFilesAfterEnv: ["<rootDir>/tests-layered/jest.setup.ts"],
  testPathIgnorePatterns: ["/dist/"]
};
