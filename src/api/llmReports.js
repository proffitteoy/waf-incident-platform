import { request } from './http'

export const LLMReportsApi = {
  list(params) {
    return request('/llm-reports', { query: params })
  },

  detail(id) {
    return request(`/llm-reports/${id}`)
  },

  listByIncident(incidentId, params) {
    return request(`/incidents/${incidentId}/llm-reports`, { query: params })
  },

  regenerate(id, payload) {
    return request(`/llm-reports/${id}/regenerate`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },
}

