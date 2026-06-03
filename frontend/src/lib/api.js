import axios from 'axios'
import { supabase } from './supabase'

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]')

const baseURL = (isLocalhost ? import.meta.env.VITE_API_URL : null) || '/api'

const api = axios.create({ baseURL })

// Attach Supabase JWT to every request to the Express API
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || 'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

export default api
