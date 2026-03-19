import { request } from './http'

export const IncidentsApi = {
  list(params) {
    return request('/incidents', { query: params })
  },

  detail(id) {
    return request(`/incidents/${id}`)
  },

  triggerAnalyze(id) {
    return request(`/incidents/${id}/analyze`, { method: 'POST' })
  },

  analyzeBatch(payload) {
    return request('/incidents/analyze-batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateStatus(id, payload) {
    return request(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  addComment(id, payload) {
    return request(`/incidents/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getComments(id) {
    return request(`/incidents/${id}/comments`)
  },

  createAction(id, payload) {
    return request(`/incidents/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}

