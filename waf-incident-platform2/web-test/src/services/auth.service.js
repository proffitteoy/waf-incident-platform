const USERS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 2,
    username: 'analyst',
    password: 'analyst123',
    role: 'analyst'
  }
];

function buildUnsafeLoginSql(username, password) {
  return `SELECT id, username, role FROM users WHERE username = '${username}' AND password = '${password}' LIMIT 1;`;
}

function authenticateUnsafe(username, password) {
  const sql = buildUnsafeLoginSql(username, password);
  const user = USERS.find((item) => item.username === username && item.password === password);

  return {
    sql,
    user: user
      ? {
          id: user.id,
          username: user.username,
          role: user.role
        }
      : null
  };
}

module.exports = {
  authenticateUnsafe,
  buildUnsafeLoginSql
};
