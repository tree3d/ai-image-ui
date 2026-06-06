<template>
  <div
    class="gallery-card"
    :class="{
      failed: job.status === 'error',
      generating: job.status === 'generating',
      queued: job.status === 'queued'
    }"
  >
    <button
      class="preview-remove"
      type="button"
      :aria-label="job.status === 'generating' ? 'Generating' : 'Remove preview'"
      :disabled="job.status === 'generating'"
      :class="{ locked: job.status === 'generating' }"
      @click.stop.prevent="job.status !== 'generating' && $emit('remove', job.id)"
    >
      <AppIcon :name="job.status === 'generating' ? 'lock' : 'x'" />
    </button>

    <button
      class="preview-copy"
      type="button"
      :aria-label="job.copied ? 'Copied' : 'Copy prompt or error'"
      @click.stop.prevent="$emit('copy', job)"
    >
      <AppIcon :name="job.copied ? 'check' : 'copy'" />
    </button>

    <img
      v-if="job.status === 'done' && job.image"
      :src="job.image"
      class="gallery-img"
      draggable="true"
      @click="$emit('open', job.image)"
      @dragstart="$emit('drag-start', $event, job)"
      @dragend="$emit('drag-end')"
    />

    <div v-else-if="job.status === 'generating'" class="job-placeholder">
      <div class="status-spinner"></div>
      <strong>Generating...</strong>
      <small>{{ job.prompt }}</small>
    </div>

    <div v-else-if="job.status === 'queued'" class="job-placeholder">
      <strong>Queued</strong>
      <small>{{ job.prompt }}</small>
    </div>

    <div v-else class="job-placeholder error">
      <strong>Failed</strong>
      <small>{{ job.error }}</small>
    </div>

    <div v-if="job.status === 'done' && job.image" class="gallery-actions">
      <button type="button" @click.stop="$emit('open', job.image)">
        Enlarge
      </button>

      <span></span>

      <button
        type="button"
        @click.stop.prevent="$emit('download', job.image, job.filename)"
      >
        Download
      </button>
    </div>
  </div>
</template>

<script setup>
import AppIcon from "../ui/AppIcon.vue"

defineProps({
  job: {
    type: Object,
    required: true
  }
})

defineEmits([
  "copy",
  "download",
  "drag-end",
  "drag-start",
  "open",
  "remove"
])
</script>
