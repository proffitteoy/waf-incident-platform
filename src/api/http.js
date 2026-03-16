function getBaseUrl() {
  return (import.meta?.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
}

function buildUrl(path, query) {
  const base = `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`
  if (!query || typeof query !== 'object') return base
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)))
    } else {
      search.append(key, String(value))
    }
  })
  const qs = search.toString()
  return qs ? `${base}?${qs}` : base
}

export async function request(path, options = {}) {
  const { query, ...rest } = options
  const url = buildUrl(path, query)

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(rest.headers || {}),
    },
    ...rest,
  })

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const message = typeof data === 'string' ? data : data?.message
    throw new Error(message || `Request failed: ${res.status}`)
  }
  return data
}

