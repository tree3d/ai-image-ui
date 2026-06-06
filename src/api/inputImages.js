import { api } from "./client"

export const deleteInputImageRequest = (filename) => {
  return api.delete(`/input-images/${encodeURIComponent(filename)}`)
}

export const getInputImages = () => {
  return api.get("/input-images")
}

export const getLastPrompt = () => {
  return api.get("/last-prompt")
}

export const saveInputOrderRequest = (order) => {
  return api.post("/input-images/order", { order })
}

export const uploadReferenceImages = (formData) => {
  return api.post("/upload-reference", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  })
}
