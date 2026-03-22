import { request } from './http'

export const SettingsApi = {
  getLlm() {
    return request('/settings/llm')
  },

  updateLlm(payload) {
    return request('/settings/llm', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
}
