import { request } from './http'

export const ApprovalsApi = {
  list(params) {
    return request('/approvals', { query: params })
  },

  detail(id) {
    return request(`/approvals/${id}`)
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

  batchDecide(payload) {
    return request('/approvals/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}

