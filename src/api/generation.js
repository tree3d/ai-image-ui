import { api } from "./client"

export const generateImageRequest = ({ prompt, size, quality }) => {
  return api.post("/generate", { prompt, size, quality })
}

export const cropStitchInpaintRequest = (payload) => {
  return api.post("/inpaint-crop-stitch", payload)
}

export const outpaintCropStitchRequest = (payload) => {
  return api.post("/outpaint-crop-stitch", payload, {
    headers: { "Content-Type": "multipart/form-data" }
  })
}

export const pollJobStatus = async (jobId, { intervalMs = 2000, maxAttempts = 90 } = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await api.get(`/status/${jobId}`)
    const { status, result, error } = res.data
    if (status === "done") return result
    if (status === "error") throw new Error(error || "Background job failed")
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error("Job timed out after 3 minutes")
}
