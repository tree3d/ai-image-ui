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
