import { request } from './http'

export const PoliciesApi = {
  detail(id) {
    return request(`/policies/${id}`)
  },

  list(params) {
    return request('/policies', { query: params })
  },

  update(id, payload) {
    return request(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
}
