import { request } from './http'

export const LLMReportsApi = {
  listByIncident(incidentId, params) {
    return request(`/incidents/${incidentId}/llm-reports`, { query: params })
  },
}
