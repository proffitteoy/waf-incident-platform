import { request } from './http'

export const PoliciesApi = {
  list(params) {
    return request('/policies', { query: params })
  },

  detail(id) {
    return request(`/policies/${id}`)
  },

  create(payload) {
    return request('/policies', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id, payload) {
    return request(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  remove(id) {
    return request(`/policies/${id}`, {
      method: 'DELETE',
    })
  },

  updateStatus(id, payload) {
    return request(`/policies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
}

