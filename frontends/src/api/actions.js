import { request } from './http'

export const ActionsApi = {
  rollback(id, payload) {
    return request(`/actions/${id}/rollback`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },
}
