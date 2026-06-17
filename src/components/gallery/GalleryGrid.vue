<template>
  <GalleryScaleControl v-model="scale" :percent="percent" />
  <GalleryToolbar @purge="$emit('purge')" />

  <div class="gallery-grid" :style="{ '--gallery-columns': columns }">
    <GalleryCard
      v-for="job in jobs"
      :key="job.id"
      :job="job"
      @animate="$emit('animate', $event)"
      @copy="$emit('copy', $event)"
      @download="(src, filename) => $emit('download', src, filename)"
      @drag-end="$emit('drag-end')"
      @drag-start="(event, draggedJob) => $emit('drag-start', event, draggedJob)"
      @open="$emit('open', $event)"
      @open-video="$emit('open-video', $event)"
      @remove="$emit('remove', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from "vue"
import GalleryCard from "./GalleryCard.vue"
import GalleryScaleControl from "./GalleryScaleControl.vue"
import GalleryToolbar from "./GalleryToolbar.vue"

const props = defineProps({
  columns: {
    type: Number,
    required: true
  },
  jobs: {
    type: Array,
    required: true
  },
  modelValue: {
    type: Number,
    required: true
  },
  percent: {
    type: Number,
    required: true
  }
})

const emit = defineEmits([
  "animate",
  "copy",
  "download",
  "drag-end",
  "drag-start",
  "open",
  "open-video",
  "purge",
  "remove",
  "update:modelValue"
])

const scale = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
})
</script>
