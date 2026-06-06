import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      "/generate": "http://localhost:5010",
      "/upload-reference": "http://localhost:5010",
      "/input-images": "http://localhost:5010",
      "/last-prompt": "http://localhost:5010",
      "/inpaint": "http://localhost:5010",
      "/outpaint-crop-stitch": "http://127.0.0.1:5010",
      "/inpaint-crop-stitch": "http://127.0.0.1:5010",
    }
  }
})