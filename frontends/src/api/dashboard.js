import { request } from './http'

export const DashboardApi = {
  overview(params) {
    return request('/dashboard/overview', { query: params })
  },

  timeseries(params) {
    return request('/dashboard/timeseries', { query: params })
  },
}
