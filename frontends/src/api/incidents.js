import { request } from './http'

export const IncidentsApi = {
  list(params) {
    return request('/incidents', { query: params })
  },

  detail(id) {
    return request(`/incidents/${id}`)
  },

  analyzeEvents(payload) {
    return request('/incidents/analyze-events', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  addComment(id, payload) {
    return request(`/incidents/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  executeAction(id, payload) {
    return request(`/incidents/${id}/actions/execute`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  requestApproval(id, payload) {
    return request(`/incidents/${id}/actions/request-approval`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getLlmReports(id) {
    return request(`/incidents/${id}/llm-reports`)
  },

  createLlmReport(id, payload) {
    return request(`/incidents/${id}/llm-reports`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
