const mimeLib = require("mime");

if (typeof mimeLib.getType !== "function" && typeof mimeLib.lookup === "function") {
  mimeLib.getType = mimeLib.lookup.bind(mimeLib);
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
