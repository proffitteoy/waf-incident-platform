import { request } from './http'

export const ApprovalsApi = {
  detail(id) {
    return request(`/approvals/${id}`)
  },

  list(params) {
    return request('/approvals', { query: params })
  },

  approve(id, payload) {
    return request(`/approvals/${id}/approve`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },

  reject(id, payload) {
    return request(`/approvals/${id}/reject`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },

  remove(id) {
    return request(`/approvals/${id}`, { method: 'DELETE' })
  },
}
