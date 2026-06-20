import { computed, ref } from "vue"

export const useGalleryScale = () => {
  const galleryScale = ref(0)

  const galleryPercent = computed(() => {
    return Math.round(galleryScale.value * 100)
  })

  const galleryColumns = computed(() => {
    if (galleryScale.value < 0.16) return 6
    if (galleryScale.value < 0.32) return 5
    if (galleryScale.value < 0.48) return 4
    if (galleryScale.value < 0.64) return 3
    if (galleryScale.value < 0.84) return 2
    return 1
  })

  return {
    galleryColumns,
    galleryPercent,
    galleryScale
  }
}
