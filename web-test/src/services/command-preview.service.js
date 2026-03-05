function buildUnsafePingCommand(host) {
  return `ping -c 1 ${host}`;
}

module.exports = {
  buildUnsafePingCommand
};
