import { request } from './http'

export const ActionsApi = {
  list(params) {
    return request('/actions', { query: params })
  },

  detail(id) {
    return request(`/actions/${id}`)
  },

  execute(payload) {
    return request('/actions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  rollback(id, payload) {
    return request(`/actions/${id}/rollback`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },

  status(id) {
    return request(`/actions/${id}/status`)
  },

  logs(id) {
    return request(`/actions/${id}/logs`)
  },
}

