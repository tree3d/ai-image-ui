<template>
  <div class="app">
    <section class="left-panel">

      <ReferenceUploader
        v-model:input-images="inputImages"
        v-model:is-dragging="isDragging"
        v-model:reference-drop-index="referenceDropIndex"
        :deleting-images="deletingImages"
        :is-dragging-gallery="isDraggingGallery"
        @animate-reference="file => animateJob({ image: file.url, filename: file.filename })"
        @delete-input-image="deleteInputImage"
        @gallery-drop="onGalleryDrop"
        @gallery-drop-at="onGalleryDropAt"
        @handle-drop="handleDrop"
        @open-modal="openModal"
        @reset-reference-mode="resetReferenceMode"
        @save-input-order="saveInputOrder"
        @select-inpaint-image="selectInpaintImage"
        @select-outpaint-image="selectOutpaintImage"
        @upload-images="uploadImages"
      />

      <div class="divider"></div>

      <div class="card">
        <label class="label">Prompt</label>

        <textarea
          v-model="prompt"
          class="prompt-box"
          placeholder="Enter your image prompt..."
        />

        <div class="generate-actions">
          <button
            class="generate-btn"
            type="button"
            @click="
              outpaintMode
                ? generateOutpaint()
                : inpaintMode
                  ? generateCropStitchInpaint()
                  : generate()
            "
          >
            {{
              outpaintMode
                ? "Generate Outpaint"
                : inpaintMode
                  ? "Generate Crop-Stitch Inpaint"
                  : "Generate Image"
            }}
          </button>

          <button
            v-if="!outpaintMode"
            class="shield-generate-btn"
            type="button"
            title="Generate a protected job that cannot be removed while active"
            aria-label="Generate shielded image"
            @click="inpaintMode ? generateCropStitchInpaint({ shielded: true }) : generate({ shielded: true })"
          >
            <AppIcon name="shield" />
          </button>

          <button
            v-if="!outpaintMode"
            class="immediate-generate-btn"
            type="button"
            title="Generate immediately without queue or parallel limits"
            aria-label="Generate image immediately"
            @click="inpaintMode ? generateCropStitchInpaint({ immediate: true }) : generate({ immediate: true })"
          >
            <AppIcon name="zap" />
          </button>

          <div
            v-if="!outpaintMode"
            class="batch-generate-control"
          >
            <input
              v-model.number="batchCount"
              class="batch-count-input"
              type="number"
              min="1"
              max="32"
              step="1"
              title="Number of immediate parallel jobs"
              aria-label="Immediate batch job count"
              @change="clampBatchCount"
            />

            <button
              class="batch-generate-btn"
              type="button"
              title="Launch immediate parallel batch"
              aria-label="Launch immediate parallel batch"
              @click="generateBatch"
            >
              <AppIcon name="flame" />
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <div v-if="inpaintMode && selectedInpaintImage" class="inpaint-box">
          <div class="inpaint-header">
            <strong>Inpaint Mask</strong>
            <button type="button" @click="clearMask">Clear Mask</button>
            <button type="button" @click="inpaintMode = false">Exit</button>
            <button
              type="button"
              @click="maskBrushMode = maskBrushMode === 'add' ? 'subtract' : 'add'"
            >
              {{ maskBrushMode === "add" ? "Brush: Add Mask" : "Brush: Subtract Mask" }}
            </button>
          </div>

          <div
            ref="maskViewport"
            class="inpaint-viewport"
            @pointerdown="startMaskPan"
            @pointermove="moveMaskPan"
            @pointerup="stopMaskPan"
            @pointerleave="stopMaskPan"
          >
            <div
              class="inpaint-stage"
              :style="{
                transform: `scale(${maskZoom})`,
                transformOrigin: 'top center'
              }"
            >
              <img
                :src="selectedInpaintImage.url"
                class="inpaint-source"
                @load="initMaskCanvas"
              />

              <canvas
                ref="maskCanvas"
                class="mask-canvas"
                @pointerdown="startPaint"
                @pointermove="paintMask"
                @pointerup="stopPaint"
                @pointerleave="stopPaint"
              ></canvas>
            </div>
          </div>

          <label class="brush-label">
            Brush size: {{ brushSize }}
            <input
              v-model.number="brushSize"
              type="range"
              min="8"
              max="120"
              step="2"
            />
          </label>

          <div class="mask-controls">
            <label>
              Zoom: {{ Math.round(maskZoom * 100) }}%
            </label>

            <input
              v-model.number="maskZoom"
              type="range"
              min="0.5"
              max="5"
              step="0.1"
            />
          </div>
        </div>

        <div class="divider"></div>

        <div v-if="outpaintMode" class="outpaint-controls">
          <strong>Outpaint Direction</strong>

          <label>
            Top
            <input v-model.number="outpaintTop" type="number" min="0" step="64" />
          </label>

          <label>
            Right
            <input v-model.number="outpaintRight" type="number" min="0" step="64" />
          </label>

          <label>
            Bottom
            <input v-model.number="outpaintBottom" type="number" min="0" step="64" />
          </label>

          <label>
            Left
            <input v-model.number="outpaintLeft" type="number" min="0" step="64" />
          </label>
        </div>

        <div class="divider"></div>


        <OptionSelector
          v-model="selectedSize"
          title="Size"
          label="Size"
          :options="sizeOptions"
        />

        <div class="divider"></div>

        <OptionSelector
          v-model="selectedQuality"
          title="Quality"
          label="Quality"
          :options="qualityOptions"
        />

      </div>
    </section>


    <section class="right-panel">
      <UsageDashboard />

      <GalleryGrid
        v-if="jobs.length"
        v-model="galleryScale"
        :jobs="jobs"
        :columns="galleryColumns"
        :percent="galleryPercent"
        @animate="animateJob"
        @copy="copyJobText"
        @download="downloadImage"
        @drag-end="isDraggingGallery = false; referenceDropIndex = null"
        @drag-start="onGalleryDragStart"
        @open="openModal"
        @open-video="openVideoModal"
        @purge="purgePreviewImages"
        @remove="removePreviewJob"
      />

      <div v-else class="empty-state">
        Generated images will appear here
      </div>
    </section>


    <ErrorModal
      :open="errorOpen"
      :message="errorMessage"
      @close="errorOpen = false"
    />

    <ImageModal
      :open="modalOpen"
      :src="modalImage"
      @close="closeModal"
    />

    <AnimateModal
      :open="animateModalOpen"
      :source-job="animateSourceJob"
      :motion-prompt="prompt"
      @close="animateModalOpen = false"
      @submit="submitAnimateJob"
    />

    <div v-if="videoModalOpen" class="modal" @click="videoModalOpen = false">
      <video
        :src="videoModalSrc"
        class="modal-img"
        autoplay
        loop
        muted
        playsinline
        controls
        @click.stop
      />
      <button class="modal-close" @click="videoModalOpen = false"><span>×</span></button>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue"
import { qualityOptions, sizeOptions } from "../constants/options"
import {
  animateRequest,
  cropStitchInpaintRequest,
  generateImageRequest,
  outpaintCropStitchRequest,
  pollJobStatus
} from "../api/generation"
import {
  deleteInputImageRequest,
  getInputImages,
  getLastPrompt,
  saveInputOrderRequest,
  uploadReferenceImages
} from "../api/inputImages"
import AnimateModal from "../components/modal/AnimateModal.vue"
import ErrorModal from "../components/modal/ErrorModal.vue"
import ImageModal from "../components/modal/ImageModal.vue"
import OptionSelector from "../components/prompt/OptionSelector.vue"
import GalleryGrid from "../components/gallery/GalleryGrid.vue"
import UsageDashboard from "../components/stats/UsageDashboard.vue"
import ReferenceUploader from "../components/reference/ReferenceUploader.vue"
import AppIcon from "../components/ui/AppIcon.vue"
import { useGalleryScale } from "../composables/useGalleryScale"
import { useImageModal } from "../composables/useImageModal"

const jobs = ref([])

const activeNormalJobs = ref(0)
const activeShieldedJobs = ref(0)

const MAX_PARALLEL_JOBS = 2
const MAX_PARALLEL_SHIELDED_JOBS = 2

const errorOpen = ref(false)
const errorMessage = ref("")

const selectedSize = ref("auto")

const deletingImages = ref(new Set())
const inputImages = ref([])

const inpaintMode = ref(false)
const selectedInpaintImage = ref(null)
const maskCanvas = ref(null)
const maskCtx = ref(null)
const painting = ref(false)
const brushSize = ref(38)

const isMaskPanning = ref(false)
const maskPanStart = ref({ x: 0, y: 0 })
const maskScrollStart = ref({ left: 0, top: 0 })
const maskViewport = ref(null)

const maskZoom = ref(1)

const cropStitchPadding = ref(96)

const outpaintMode = ref(false)

const outpaintTop = ref(0)
const outpaintRight = ref(256)
const outpaintBottom = ref(0)
const outpaintLeft = ref(0)
const maskBrushMode = ref("add") // add | subtract

const {
  galleryColumns,
  galleryPercent,
  galleryScale
} = useGalleryScale()

const {
  closeModal,
  modalImage,
  modalOpen,
  openModal
} = useImageModal()

const selectedQuality = ref("medium")
const batchCount = ref(4)

const prompt = ref(
  "chubby bearded man, full body view, wearing loose tank top t shirt, loose sweat shorts, barefoot."
)

const pendingTimeouts = new Set()

const scheduleTimeout = (callback, delay) => {
  const timeoutId = window.setTimeout(() => {
    pendingTimeouts.delete(timeoutId)
    callback()
  }, delay)

  pendingTimeouts.add(timeoutId)
  return timeoutId
}

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"

    const cleanup = () => {
      img.onload = null
      img.onerror = null
    }

    img.onload = () => {
      cleanup()
      resolve(img)
    }

    img.onerror = (event) => {
      cleanup()
      reject(event)
    }

    img.src = src
  })
}

const formatRequestError = (err, fallback) => {
  const data = err?.response?.data
  const detail =
    data?.details ||
    data?.error ||
    err?.message ||
    fallback

  return typeof detail === "string"
    ? detail
    : JSON.stringify(detail, null, 2)
}

const startMaskPan = (event) => {
  if (event.button !== 1) return
  if (!maskViewport.value) return

  event.preventDefault()

  isMaskPanning.value = true

  maskPanStart.value = {
    x: event.clientX,
    y: event.clientY
  }

  maskScrollStart.value = {
    left: maskViewport.value.scrollLeft,
    top: maskViewport.value.scrollTop
  }

  maskViewport.value.setPointerCapture?.(event.pointerId)
}

const moveMaskPan = (event) => {
  if (!isMaskPanning.value) return
  if (!maskViewport.value) return

  event.preventDefault()

  const dx = event.clientX - maskPanStart.value.x
  const dy = event.clientY - maskPanStart.value.y

  maskViewport.value.scrollLeft =
    maskScrollStart.value.left - dx

  maskViewport.value.scrollTop =
    maskScrollStart.value.top - dy
}

const stopMaskPan = (event) => {
  if (!isMaskPanning.value) return

  isMaskPanning.value = false
  maskViewport.value?.releasePointerCapture?.(event.pointerId)
}

const draggedGalleryJob = ref(null)
const isDraggingGallery = ref(false)
const referenceDropIndex = ref(null)
const isDragging = ref(false)

const onGalleryDragStart = (event, job) => {
  draggedGalleryJob.value = job
  isDraggingGallery.value = true
  event.dataTransfer.effectAllowed = "copy"
}

const onGalleryDropAt = async (targetIndex) => {
  const job = draggedGalleryJob.value

  if (!job?.image) return

  if (inputImages.value.length >= 5) {
    showError(
      { message: "Maximum of 5 reference images allowed" },
      "Reference image limit reached"
    )
    draggedGalleryJob.value = null
    return
  }

  try {
    const response = await fetch(job.image)
    const blob = await response.blob()

    const file = new File(
      [blob],
      job.filename || `nt-${randomHash()}.png`,
      { type: blob.type || "image/png" }
    )

    const formData = new FormData()
    formData.append("images", file)

    const uploadRes = await uploadReferenceImages(formData)

    await loadInputImages()

    const uploaded =
      uploadRes.data.files?.find(f => f.filename === file.name) ||
      inputImages.value.find(f => f.filename === file.name)

    const uploadedFilename = uploaded?.filename || inputImages.value.at(-1)?.filename

    if (!uploadedFilename) return

    const reordered = inputImages.value.filter(
      img => img.filename !== uploadedFilename
    )

    reordered.splice(targetIndex, 0, {
      filename: uploadedFilename,
      url: `/input/${uploadedFilename}`
    })

    inputImages.value = reordered

    await saveInputOrder()
  } catch (err) {
    showError(err, "Could not place gallery image into reference position")
  } finally {
    draggedGalleryJob.value = null
    isDraggingGallery.value = false
    referenceDropIndex.value = null
  }
}

watch(
  () => inputImages.value.length,
  (count) => {
    if (count === 0) {
      selectedInpaintImage.value = null

      inpaintMode.value = false
      outpaintMode.value = false

      return
    }

    if (count > 1) {
      inputImages.value.forEach(img => {
        img.mode = "normal"
      })

      selectedInpaintImage.value = null

      inpaintMode.value = false
      outpaintMode.value = false

    }
  }
)

const resetReferenceMode = (file) => {
  file.mode = "normal"

  if (selectedInpaintImage.value?.filename === file.filename) {
    selectedInpaintImage.value = null
  }

  inpaintMode.value = false
  outpaintMode.value = false

  clearMask()
}

const selectOutpaintImage = (file) => {
  file.mode = "outpaint"

  selectedInpaintImage.value = file

  outpaintMode.value = true
  inpaintMode.value = false
}

const onGalleryDrop = async () => {
  const job = draggedGalleryJob.value

  if (!job?.image) return

  if (inputImages.value.length >= 5) {
    showError(
      { message: "Maximum of 5 reference images allowed" },
      "Reference image limit reached"
    )
    draggedGalleryJob.value = null
    return
  }

  const response = await fetch(job.image)
  const blob = await response.blob()

  const file = new File(
    [blob],
    job.filename || `nt-${randomHash()}.png`,
    { type: blob.type || "image/png" }
  )

  const formData = new FormData()
  formData.append("images", file)

  try {
    await uploadReferenceImages(formData)

    await loadInputImages()
  } catch (err) {
    showError(err, "Could not add gallery image as reference")
  } finally {
    draggedGalleryJob.value = null
    isDraggingGallery.value = false
    referenceDropIndex.value = null
  }
}

const selectInpaintImage = (file) => {
  file.mode = "inpaint"
  selectedInpaintImage.value = file
  inpaintMode.value = true
  outpaintMode.value = false


  scheduleTimeout(() => {
    initMaskCanvas()
  }, 0)
}

const loadLastPrompt = async () => {
  try {
    const res = await getLastPrompt()

    if (res.data.prompt) {
      prompt.value = res.data.prompt
    }
  } catch (err) {
    console.warn("Could not load last prompt", err)
  }
}

const purgePreviewImages = () => {
  const now = Date.now()

  jobs.value = jobs.value.filter((job) => {
    const age = now - (job.finishedAt || now)

    // Keep active jobs
    if (job.status === "queued" || job.status === "generating") {
      return true
    }

    // Keep completed/failed jobs younger than 5 seconds
    if (
      (job.status === "done" || job.status === "error") &&
      age < 5000
    ) {
      return true
    }

    // Remove completed/failed jobs older than 5 seconds
    return false
  })
}

const copyJobText = async (job) => {
  const text =
    job.status === "error"
      ? typeof job.error === "string"
        ? job.error
        : JSON.stringify(job.error, null, 2)
      : job.prompt

  try {
    await navigator.clipboard.writeText(text || "")
    job.copied = true

    scheduleTimeout(() => {
      job.copied = false
    }, 1200)
  } catch (err) {
    showError(err, "Could not copy text")
  }
}

const removePreviewJob = (jobId) => {
  jobs.value = jobs.value.filter(job =>
    job.id !== jobId || (job.shielded && isActiveJob(job))
  )
}

const uploadFileList = async (fileList) => {
  const files = Array.from(fileList || []).filter(file =>
    file.type.startsWith("image/")
  )

  if (!files.length) return

  const formData = new FormData()

  files.slice(0, 5).forEach(file => {
    formData.append("images", file)
  })

  try {
    await uploadReferenceImages(formData)

    await loadInputImages()
  } catch (err) {
    showError(err, "Image upload failed")
  }
}

const handleDrop = async (event) => {
  isDragging.value = false
  await uploadFileList(event.dataTransfer.files)
}

const saveInputOrder = async () => {
  try {
    await saveInputOrderRequest(inputImages.value.map(file => file.filename))
  } catch (err) {
    showError(err, "Could not save image order")
  }
}

const uploadImages = async (event) => {
  const files = Array.from(event.target.files || [])

  if (!files.length) return

  const formData = new FormData()

  files.slice(0, 5).forEach(file => {
    formData.append("images", file)
  })

  try {
    await uploadReferenceImages(formData)

    await loadInputImages()
  } catch (err) {
    showError(err, "Image upload failed")
  } finally {
    event.target.value = ""
  }
}

const loadInputImages = async () => {
  try {
    const res = await getInputImages()

    const previousModes = new Map(
      inputImages.value.map(img => [
        img.filename,
        img.mode || "normal"
      ])
    )

    inputImages.value = (res.data.files || []).map(file => ({
      ...file,
      mode: previousModes.get(file.filename) || "normal"
    }))

    if (inputImages.value.length === 0) {
      selectedInpaintImage.value = null
      inpaintMode.value = false
      outpaintMode.value = false
      return
    }

    if (inputImages.value.length > 1) {
      inputImages.value.forEach(img => {
        img.mode = "normal"
      })

      selectedInpaintImage.value = null
      inpaintMode.value = false
      outpaintMode.value = false
    }
  } catch (err) {
    showError(err, "Could not load input images")
  }
}

onMounted(() => {
  loadLastPrompt()
  loadInputImages()
})

onUnmounted(() => {
  for (const timeoutId of pendingTimeouts) {
    window.clearTimeout(timeoutId)
  }

  pendingTimeouts.clear()
  maskCtx.value = null
  draggedGalleryJob.value = null
})

const deleteInputImage = async (filename) => {
  if (deletingImages.value.has(filename)) return

  deletingImages.value.add(filename)

  try {
    await deleteInputImageRequest(filename)
    await loadInputImages()
  } catch (err) {
    showError(err, "Could not delete input image")
  } finally {
    deletingImages.value.delete(filename)
  }
}

const initMaskCanvas = () => {
  const canvas = maskCanvas.value
  const img = document.querySelector(".inpaint-source")

  if (!canvas || !img) return

  // Buffer at natural resolution for pixel-accurate masking.
  // CSS sized to offsetWidth/offsetHeight (layout px, unaffected by zoom transform)
  // so the canvas overlay exactly covers the image at every zoom level.
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.style.width = img.offsetWidth + 'px'
  canvas.style.height = img.offsetHeight + 'px'

  const ctx = canvas.getContext("2d")
  maskCtx.value = ctx

  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

const getCanvasPoint = (event) => {
  const rect = maskCanvas.value.getBoundingClientRect()

  // rect dimensions are display pixels (affected by CSS zoom transform).
  // canvas.width/height are natural image pixels.
  // Compute scale to convert screen offset → canvas pixel coordinates.
  const scaleX = maskCanvas.value.width / rect.width
  const scaleY = maskCanvas.value.height / rect.height

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

const startPaint = (event) => {
  // only left mouse / pen primary button paints
  if (event.button !== 0) return

  painting.value = true
  paintMask(event)
}

const paintMask = (event) => {
  // prevent middle/right mouse from painting
  if (event.buttons && !(event.buttons & 1)) return

  if (!painting.value || !maskCtx.value) return

  const { x, y } = getCanvasPoint(event)

  maskCtx.value.beginPath()
  maskCtx.value.arc(x, y, brushSize.value / 2, 0, Math.PI * 2)

  if (maskBrushMode.value === "add") {
    maskCtx.value.globalCompositeOperation = "source-over"
    maskCtx.value.fillStyle = "rgba(255,255,255,1)"
  } else {
    maskCtx.value.globalCompositeOperation = "destination-out"
    maskCtx.value.fillStyle = "rgba(0,0,0,1)"
  }

  maskCtx.value.fill()
  maskCtx.value.globalCompositeOperation = "source-over"
}

const stopPaint = () => {
  painting.value = false
}

const clearMask = () => {
  const canvas = maskCanvas.value
  if (!canvas || !maskCtx.value) return

  maskCtx.value.clearRect(0, 0, canvas.width, canvas.height)
}

const generateOutpaint = async () => {
  if (!prompt.value.trim()) {
    showError({ message: "Prompt is required" }, "Outpaint failed")
    return
  }

  if (!selectedInpaintImage.value) {
    showError(
      { message: "Select an image for outpainting first" },
      "Outpaint failed"
    )
    return
  }

  const job = {
    id: crypto.randomUUID(),
    type: "outpaint",
    payload: null,
    prompt: prompt.value.trim(),
    status: "queued",
    image: null,
    filename: null,
    error: null,
    finishedAt: null
  }

  jobs.value.unshift(job)

  try {
    const img = await loadImage(selectedInpaintImage.value.url)

    const top = Math.max(0, outpaintTop.value || 0)
    const right = Math.max(0, outpaintRight.value || 0)
    const bottom = Math.max(0, outpaintBottom.value || 0)
    const left = Math.max(0, outpaintLeft.value || 0)

    if (top + right + bottom + left === 0) {
      throw new Error("Set at least one outpaint direction above 0 pixels.")
    }

    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth + left + right
    canvas.height = img.naturalHeight + top + bottom

    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, left, top)

    const maskCanvas = document.createElement("canvas")
    maskCanvas.width = canvas.width
    maskCanvas.height = canvas.height

    const maskCtx = maskCanvas.getContext("2d")

    // Opaque white = preserve original
    maskCtx.fillStyle = "rgba(255,255,255,1)"
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)

    // Transparent areas = editable / outpaint areas
    if (top > 0) {
      maskCtx.clearRect(0, 0, maskCanvas.width, top)
    }

    if (left > 0) {
      maskCtx.clearRect(0, top, left, img.naturalHeight)
    }

    if (right > 0) {
      maskCtx.clearRect(
        left + img.naturalWidth,
        top,
        right,
        img.naturalHeight
      )
    }

    if (bottom > 0) {
      maskCtx.clearRect(
        0,
        top + img.naturalHeight,
        maskCanvas.width,
        bottom
      )
    }

    const sourceBlob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/png")
    )

    const maskBlob = await new Promise(resolve =>
      maskCanvas.toBlob(resolve, "image/png")
    )

    if (!sourceBlob || !maskBlob) {
      throw new Error("Could not create outpaint source or mask.")
    }

    const outpaintPrompt =
      `Extend the existing image only into the transparent canvas area. ` +
      `Preserve the original image content, composition, identity, pose, lighting, and camera perspective. ` +
      prompt.value.trim()

    const formData = new FormData()
    formData.append("prompt", outpaintPrompt)
    formData.append("size", selectedSize.value || "1024x1024")
    formData.append("quality", selectedQuality.value || "medium")
    formData.append("source", sourceBlob, "outpaint-source.png")
    formData.append("mask", maskBlob, "outpaint-mask.png")

    job.payload = formData

    shuffleQueuedJobs()
    processQueue()
  } catch (err) {
    job.status = "error"
    job.finishedAt = Date.now()
    job.error = formatRequestError(err, "Outpaint failed")
  }
}

const generateCropStitchInpaint = async ({ shielded = false, immediate = false, batch = false } = {}) => {
  if (!prompt.value.trim()) {
    showError({ message: "Prompt is required" }, "Crop-stitch failed")
    return
  }

  if (!selectedInpaintImage.value) {
    showError(
      { message: "Select an image for inpainting first" },
      "Crop-stitch failed"
    )
    return
  }

  if (!maskCanvas.value) {
    showError(
      { message: "Paint a mask before generating" },
      "Crop-stitch failed"
    )
    return
  }

  const job = {
    id: crypto.randomUUID(),
    type: "crop-stitch-inpaint",
    payload: null,
    prompt: prompt.value.trim(),
    shielded,
    immediate,
    batch,
    status: "queued",
    image: null,
    filename: null,
    error: null,
    finishedAt: null
  }

  try {
    const img = await loadImage(selectedInpaintImage.value.url)

    const sourceCanvas = document.createElement("canvas")
    sourceCanvas.width = img.naturalWidth
    sourceCanvas.height = img.naturalHeight

    const sourceCtx = sourceCanvas.getContext("2d")
    sourceCtx.drawImage(img, 0, 0)

    const sourceBlob = await new Promise(resolve =>
      sourceCanvas.toBlob(resolve, "image/png")
    )

    const normalizedMaskCanvas = document.createElement("canvas")
    normalizedMaskCanvas.width = img.naturalWidth
    normalizedMaskCanvas.height = img.naturalHeight

    const normalizedMaskCtx = normalizedMaskCanvas.getContext("2d")
    normalizedMaskCtx.drawImage(
      maskCanvas.value,
      0,
      0,
      maskCanvas.value.width,
      maskCanvas.value.height,
      0,
      0,
      img.naturalWidth,
      img.naturalHeight
    )

    const maskBlob = await new Promise(resolve =>
      normalizedMaskCanvas.toBlob(resolve, "image/png")
    )

    const formData = new FormData()
    formData.append("prompt", prompt.value.trim())
    formData.append("size", selectedSize.value || "1024x1024")
    formData.append("quality", selectedQuality.value || "medium")
    formData.append("padding", cropStitchPadding.value || 96)
    formData.append("source", sourceBlob, "source.png")
    formData.append("mask", maskBlob, "mask.png")

    const extraRefs = inputImages.value.filter(
      img => img.filename !== selectedInpaintImage.value.filename
    )

    for (const ref of extraRefs) {
      const response = await fetch(ref.url)
      const blob = await response.blob()

      formData.append(
        "references",
        blob,
        ref.filename || `reference-${randomHash()}.png`
      )
    }

    job.payload = formData

    jobs.value.unshift(job)

    if (immediate) {
      startQueuedJob(job, { countsTowardLimit: false })
      return
    }

    shuffleQueuedJobs()
    processQueue()
  } catch (err) {
    job.status = "error"
    job.finishedAt = Date.now()
    job.error = formatRequestError(err, "Crop-stitch failed")

    jobs.value.unshift(job)
  }
}

const showError = (err, fallback = "Generation failed") => {
  const data = err?.response?.data

  console.log("AXIOS ERROR:", err)
  console.log("SERVER RESPONSE DATA:", data)

  if (data) {
    errorMessage.value =
      typeof data.details === "string"
        ? data.details
        : data.details
          ? JSON.stringify(data.details, null, 2)
          : data.error || fallback
  } else {
    errorMessage.value = err?.message || fallback
  }

  errorOpen.value = false
}

const shuffleQueuedJobs = () => {
  const queued = jobs.value.filter(j => j.status === "queued")
  const others = jobs.value.filter(j => j.status !== "queued")

  for (let i = queued.length - 1; i > 0; i--) {
    const rand = Math.floor(Math.random() * (i + 1))
    ;[queued[i], queued[rand]] = [queued[rand], queued[i]]
  }

  jobs.value = [...queued, ...others]
}

const clearQueuedJobs = () => {
  jobs.value = jobs.value.filter(j =>
    j.status !== "queued" || j.shielded
  )
}

const isActiveJob = (job) =>
  job.status === "queued" || job.status === "generating"

const clampBatchCount = () => {
  const count = Number.isFinite(Number(batchCount.value))
    ? Math.trunc(Number(batchCount.value))
    : 1

  batchCount.value = Math.max(1, Math.min(32, count))
  return batchCount.value
}

const generateBatch = () => {
  if (!prompt.value.trim()) return

  const count = clampBatchCount()

  for (let index = 0; index < count; index++) {
    if (inpaintMode.value) {
      generateCropStitchInpaint({ immediate: true, batch: true })
    } else {
      generate({ immediate: true, batch: true })
    }
  }
}

const generate = ({
  shielded = false,
  immediate = false,
  batch = false
} = {}) => {
  if (!prompt.value.trim()) return

  const job = {
    id: crypto.randomUUID(),
    type: "generate",
    prompt: prompt.value.trim(),
    size: selectedSize.value || "1024x1024",
    quality: selectedQuality.value || "medium",
    shielded,
    immediate,
    batch,
    status: "queued",
    image: null,
    filename: null,
    error: null,
    finishedAt: null
  }

  jobs.value.unshift(job)

  if (immediate) {
    startQueuedJob(job, { countsTowardLimit: false })
    return
  }

  shuffleQueuedJobs()
  processQueue()
}

const startQueuedJob = (job, { countsTowardLimit = true } = {}) => {
  const activeCounter = job.shielded
    ? activeShieldedJobs
    : activeNormalJobs

  if (countsTowardLimit) {
    activeCounter.value += 1
  }

  job.status = "generating"

  ;(async () => {
    try {
      let result

      if (job.type === "animate") {
        const startRes = await animateRequest({
          filename: job.sourceFilename,
          prompt: job.prompt,
          duration: job.duration,
          resolution: job.resolution
        })
        result = await pollJobStatus(startRes.data.jobId, { maxAttempts: 150 })
      } else if (job.type === "outpaint") {
        result = (await outpaintCropStitchRequest(job.payload)).data
      } else if (job.type === "crop-stitch-inpaint") {
        result = (await cropStitchInpaintRequest(job.payload)).data
      } else {
        result = (await generateImageRequest({
          prompt: job.prompt,
          size: job.size,
          quality: job.quality
        })).data
      }

      job.filename = result.filename || `nt-${randomHash()}.mp4`

      if (job.type === "animate") {
        job.video = `/output/${result.filename}?t=${Date.now()}`
      } else if (result.image) {
        job.image = `data:${result.mimeType || "image/png"};base64,${result.image}`
      } else if (result.filename) {
        job.image = `/output/${result.filename}?t=${Date.now()}`
      } else {
        throw new Error("Job completed but returned no image or filename")
      }

      job.status = "done"
      job.finishedAt = Date.now()

      // A successful protected job must not clear ordinary waiting jobs.
      if (!job.shielded && !job.immediate) {
        clearQueuedJobs()
      }

      jobs.value = jobs.value.map(j =>
        j.id === job.id ? { ...job } : j
      )
    } catch (err) {
      job.status = "error"
      job.finishedAt = Date.now()
      job.error = formatRequestError(err, "Generation failed")

      if (job.type === "animate" && err?.response?.status === 401) {
        errorMessage.value = err.response.data?.error || "FAL_KEY is not configured. Add FAL_KEY to your .env file to enable animation."
        errorOpen.value = true
      }

      jobs.value = jobs.value.map(j =>
        j.id === job.id ? { ...job } : j
      )
    } finally {
      if (countsTowardLimit) {
        activeCounter.value -= 1
        shuffleQueuedJobs()
        processQueue()
      }
    }
  })()
}

const processQueue = () => {
  while (activeNormalJobs.value < MAX_PARALLEL_JOBS) {
    const job = jobs.value.find(j =>
      j.status === "queued" && !j.shielded
    )

    if (!job) break

    startQueuedJob(job)
  }

  while (activeShieldedJobs.value < MAX_PARALLEL_SHIELDED_JOBS) {
    const job = jobs.value.find(j =>
      j.status === "queued" && j.shielded
    )

    if (!job) break

    startQueuedJob(job)
  }
}

const videoModalOpen = ref(false)
const videoModalSrc = ref(null)

const openVideoModal = (src) => {
  videoModalSrc.value = src
  videoModalOpen.value = true
}

const animateModalOpen = ref(false)
const animateSourceJob = ref(null)

const animateJob = (sourceJob) => {
  animateSourceJob.value = sourceJob
  animateModalOpen.value = true
}

const submitAnimateJob = ({ duration, resolution, prompt: modalPrompt }) => {
  const sourceJob = animateSourceJob.value
  if (!sourceJob) return

  const job = {
    id: crypto.randomUUID(),
    type: "animate",
    sourceFilename: sourceJob.filename,
    sourceImage: sourceJob.image,
    prompt: modalPrompt?.trim() || prompt.value.trim(),
    duration,
    resolution,
    status: "queued",
    image: sourceJob.image,
    video: null,
    filename: null,
    error: null,
    finishedAt: null
  }

  jobs.value.unshift(job)
  startQueuedJob(job, { countsTowardLimit: false })
}

const randomHash = () => {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}

const downloadImage = async (src, filename = null) => {
  if (!src) return

  const safeFilename =
    filename || `nt-${randomHash()}.png`

  let objectUrl = null

  try {
    let blob

    const response = await fetch(src)
    blob = await response.blob()

    objectUrl = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = objectUrl
    link.download = safeFilename
    link.style.display = "none"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    showError(err, "Download failed")
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }
  }
}
</script>







