import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { localApi } from './server/api.js'
export default defineConfig(({ mode }) => ({
  plugins: [react(), localApi(loadEnv(mode, process.cwd(), 'GROQ_'))],
  server: { host: '127.0.0.1' },
}))

