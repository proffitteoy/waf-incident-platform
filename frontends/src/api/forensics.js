import { request } from './http'

export const ForensicsApi = {
  list(params) {
    return request('/forensics', { query: params })
  },

  detail(id) {
    return request(`/forensics/${id}`)
  },

  create(payload) {
    return request('/forensics', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  cancel(id, payload) {
    return request(`/forensics/${id}/cancel`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },

  download(id) {
    // 调用方可根据需要改为 window.location.href 等方式处理文件下载
    return request(`/forensics/${id}/download`)
  },

  status(id) {
    return request(`/forensics/${id}/status`)
  },
}

