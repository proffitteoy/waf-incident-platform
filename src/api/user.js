import { request } from './http'

export const UserApi = {
  async login(payload) {
    return request('/user/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async register(payload) {
    return request('/user/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}

