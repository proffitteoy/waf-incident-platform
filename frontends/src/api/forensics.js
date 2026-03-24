import { request } from './http'

export const ForensicsApi = {
  list(params) {
    return request('/forensics', { query: params })
  },

  listByIncident(incidentId, params) {
    return request(`/incidents/${incidentId}/forensics`, { query: params })
  },

  capture(incidentId, payload) {
    return request(`/incidents/${incidentId}/forensics/capture`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },

  detail(id) {
    return request(`/forensics/${id}`)
  },

  updateStatus(id, payload) {
    return request(`/forensics/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  download(id) {
    return request(`/forensics/${id}/download`)
  },
}
