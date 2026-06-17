<template>
  <div class="upload-block">
    <div class="upload-title">
      Reference Images (Optional)
      <span class="count-pill">{{ inputImagesModel.length }}/5</span>
    </div>

    <div
      class="reference-row"
      @dragover.prevent
      @drop.prevent="$emit('gallery-drop')"
    >
      <div
        v-if="isDraggingGallery"
        class="drop-slot"
        :class="{ active: referenceDropIndexModel === 0 }"
        @dragover.prevent="referenceDropIndexModel = 0"
        @drop.stop.prevent="$emit('gallery-drop-at', 0)"
      ></div>

      <label
        class="upload-box"
        :class="{ dragging: isDraggingModel }"
        @dragover.prevent="isDraggingModel = true"
        @dragenter.prevent="isDraggingModel = true"
        @dragleave.prevent="isDraggingModel = false"
        @drop.prevent="$emit('handle-drop', $event)"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          @change="$emit('upload-images', $event)"
        />

        <div class="upload-icon">+</div>
        <div>{{ isDraggingModel ? "Drop images" : "Upload" }}</div>
        <small>{{ inputImagesModel.length }}/5</small>
      </label>

      <draggable
        v-model="inputImagesModel"
        item-key="filename"
        class="thumb-list"
        ghost-class="thumb-ghost"
        @end="$emit('save-input-order')"
      >
        <template #item="{ element: file, index }">
          <div
            class="thumb-card"
            @dragover.prevent
            @drop.stop.prevent="$emit('gallery-drop-at', index)"
          >
            <img
              :src="file.url"
              draggable="false"
              @mousedown.stop
              @click.stop="$emit('open-modal', file.url)"
            />

            <button
              class="thumb-delete"
              :class="{ processing: deletingImages.has(file.filename) }"
              type="button"
              aria-label="Delete reference image"
              :disabled="deletingImages.has(file.filename)"
              @mousedown.stop
              @touchstart.stop
              @click.stop.prevent="$emit('delete-input-image', file.filename)"
            >
              <AppIcon
                v-if="deletingImages.has(file.filename)"
                name="ellipsis"
              />
              <AppIcon v-else name="x" />
            </button>

            <div class="thumb-mode-actions">
              <button
                class="thumb-mode-btn thumb-edit"
                :class="{ active: file.mode === 'inpaint' }"
                type="button"
                title="Edit / Inpaint"
                aria-label="Edit / Inpaint"
                @mousedown.stop
                @touchstart.stop
                @click.stop.prevent="$emit('select-inpaint-image', file)"
              >
                <AppIcon name="brush" />
              </button>

              <button
                class="thumb-mode-btn thumb-outpaint"
                :class="{ active: file.mode === 'outpaint' }"
                type="button"
                title="Outpaint"
                aria-label="Outpaint"
                @mousedown.stop
                @touchstart.stop
                @click.stop.prevent="$emit('select-outpaint-image', file)"
              >
                <AppIcon name="outpaint" />
              </button>

              <button
                class="thumb-mode-btn thumb-reset"
                :class="{ active: file.mode === 'normal' }"
                type="button"
                title="Normal Generation"
                aria-label="Normal Generation"
                @mousedown.stop
                @touchstart.stop
                @click.stop.prevent="$emit('reset-reference-mode', file)"
              >
                <AppIcon name="reset" />
              </button>

              <button
                class="thumb-mode-btn"
                type="button"
                title="Animate this image"
                aria-label="Animate this image"
                @mousedown.stop
                @touchstart.stop
                @click.stop.prevent="$emit('animate-reference', file)"
              >
                <AppIcon name="clapperboard" />
              </button>
            </div>

            <div class="thumb-number">{{ index + 1 }}</div>
          </div>
        </template>
      </draggable>
    </div>

    <div class="upload-help">
      Drag images to reorder
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue"
import draggable from "vuedraggable"
import AppIcon from "../ui/AppIcon.vue"

const props = defineProps({
  deletingImages: {
    type: Object,
    required: true
  },
  inputImages: {
    type: Array,
    required: true
  },
  isDragging: {
    type: Boolean,
    required: true
  },
  isDraggingGallery: {
    type: Boolean,
    required: true
  },
  referenceDropIndex: {
    type: Number,
    default: null
  }
})

const emit = defineEmits([
  "animate-reference",
  "delete-input-image",
  "gallery-drop",
  "gallery-drop-at",
  "handle-drop",
  "open-modal",
  "reset-reference-mode",
  "save-input-order",
  "select-inpaint-image",
  "select-outpaint-image",
  "update:inputImages",
  "update:isDragging",
  "update:referenceDropIndex",
  "upload-images"
])

const inputImagesModel = computed({
  get: () => props.inputImages,
  set: value => emit("update:inputImages", value)
})

const isDraggingModel = computed({
  get: () => props.isDragging,
  set: value => emit("update:isDragging", value)
})

const referenceDropIndexModel = computed({
  get: () => props.referenceDropIndex,
  set: value => emit("update:referenceDropIndex", value)
})
</script>
