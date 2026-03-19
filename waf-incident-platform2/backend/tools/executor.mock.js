async function blockIP(_ip, _ttl) {
  return { success: true };
}

async function rateLimit(_ip, _ttl) {
  return { success: true };
}

async function rollback(_actionId) {
  return { success: true };
}

module.exports = {
  blockIP,
  rateLimit,
  rollback
};
