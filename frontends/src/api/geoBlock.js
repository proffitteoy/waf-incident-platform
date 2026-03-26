import { request } from './http'

export const GeoBlockApi = {
  list() {
    return request('/geo-block')
  },

  create(payload) {
    return request('/geo-block', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id, payload) {
    return request(`/geo-block/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  remove(id) {
    return request(`/geo-block/${id}`, { method: 'DELETE' })
  },

  lookup(ip) {
    return request('/geo-block/lookup', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    })
  },
}
