import { api } from "./client"

export const generateImageRequest = ({ prompt, size }) => {
  return api.post("/generate", { prompt, size })
}

export const inpaintRequest = (payload) => {
  return api.post("/inpaint", payload, {
    headers: { "Content-Type": "multipart/form-data" }
  })
}

export const cropStitchInpaintRequest = (payload) => {
  return api.post("/inpaint-crop-stitch", payload)
}

export const outpaintCropStitchRequest = (payload) => {
  return api.post("/outpaint-crop-stitch", payload, {
    headers: { "Content-Type": "multipart/form-data" }
  })
}
