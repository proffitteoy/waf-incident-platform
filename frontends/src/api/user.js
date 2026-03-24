import { request } from './http'

export const UserApi = {
  async login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async getMe() {
    return request('/me')
  },
}
