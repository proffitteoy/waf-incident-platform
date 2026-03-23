import { request } from './http'

export const EventsApi = {
  listEvents(params) {
    return request('/events', { query: params })
  },

  listAlerts(params) {
    return request('/alerts', { query: params })
  },
}
