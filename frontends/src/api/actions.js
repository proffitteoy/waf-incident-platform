import { request } from './http'

export const ActionsApi = {
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
