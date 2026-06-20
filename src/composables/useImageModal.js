import { ref } from "vue"

export const useImageModal = () => {
  const modalOpen = ref(false)
  const modalImage = ref(null)

  const openModal = (src) => {
    if (!src) return
    modalImage.value = src
    modalOpen.value = true
  }

  const closeModal = () => {
    modalOpen.value = false
    modalImage.value = null
  }

  return {
    closeModal,
    modalImage,
    modalOpen,
    openModal
  }
}
