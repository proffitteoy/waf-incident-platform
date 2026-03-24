import { request } from './http'

export const ActionsApi = {
  detail(id) {
    return request(`/actions/${id}`)
  },

  list(params) {
    return request('/actions', { query: params })
  },

  rollback(id, payload) {
    return request(`/actions/${id}/rollback`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },
}
