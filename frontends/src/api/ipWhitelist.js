import { request } from './http'

export const IpWhitelistApi = {
  list() {
    return request('/ip-whitelist')
  },

  create(payload) {
    return request('/ip-whitelist', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id, payload) {
    return request(`/ip-whitelist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  remove(id) {
    return request(`/ip-whitelist/${id}`, { method: 'DELETE' })
  },

  check(ip) {
    return request('/ip-whitelist/check', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    })
  },
}
