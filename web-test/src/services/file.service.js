const fs = require('fs');
const path = require('path');

const FILE_ROOT = path.resolve(__dirname, '..', '..', 'data', 'files');

function listDemoFiles() {
  return fs
    .readdirSync(FILE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function readDemoFile(name) {
  const unsafePath = path.join(FILE_ROOT, name);
  const resolvedPath = path.resolve(unsafePath);
  const allowedPrefix = `${FILE_ROOT}${path.sep}`;

  if (resolvedPath !== FILE_ROOT && !resolvedPath.startsWith(allowedPrefix)) {
    throw new Error('path traversal blocked: file is outside data/files');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`file not found: ${name}`);
  }

  return fs.readFileSync(resolvedPath, 'utf8');
}

module.exports = {
  listDemoFiles,
  readDemoFile
};
