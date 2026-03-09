function getBaseUrl() {
  return (import.meta?.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
}

async function request(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const message = typeof data === 'string' ? data : data?.message
    throw new Error(message || `Request failed: ${res.status}`)
  }
  return data
}

export const UserApi = {
  async login(payload) {
    return request('/user/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async register(payload) {
    return request('/user/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}

