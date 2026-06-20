<template>
  <div
    class="gallery-card"
    :class="{
      failed: job.status === 'error',
      generating: job.status === 'generating',
      queued: job.status === 'queued',
      shielded: job.shielded && isActive,
      immediate: job.immediate && isActive,
      batch: job.batch && isActive
    }"
  >
    <button
      class="preview-copy"
      type="button"
      :class="{ copied: job.copied }"
      :disabled="job.copied"
      :aria-label="job.copied ? 'Copied' : 'Copy prompt'"
      @click.stop.prevent="$emit('copy', job)"
    >
      <AppIcon :name="job.copied ? 'check' : 'copy'" />
    </button>

    <button
      class="preview-remove"
      type="button"
      :aria-label="isLocked ? 'Protected active job' : 'Remove preview'"
      :disabled="isLocked"
      :class="{ locked: isLocked }"
      @click.stop.prevent="!isLocked && $emit('remove', job.id)"
    >
      <AppIcon :name="isLocked ? (job.shielded ? 'shield' : 'lock') : 'x'" />
    </button>

    <div class="gallery-card-media">
      <video
        v-if="job.status === 'done' && job.video"
        :src="job.video"
        class="gallery-img gallery-video"
        autoplay
        loop
        muted
        playsinline
        @click="$emit('open-video', job.video)"
      />

      <img
        v-else-if="job.status === 'done' && job.image"
        :src="job.image"
        class="gallery-img"
        draggable="true"
        @click="$emit('open', job.image)"
        @dragstart="$emit('drag-start', $event, job)"
        @dragend="$emit('drag-end')"
      />

      <div v-else-if="job.status === 'generating'" class="job-placeholder">
        <div class="status-spinner"></div>
        <strong>{{ job.type === 'animate' ? 'Animating...' : 'Generating...' }}</strong>
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

      <div v-if="job.status === 'done' && (job.image || job.video)" class="gallery-actions">
        <button
          type="button"
          aria-label="Enlarge"
          @click.stop="job.video ? $emit('open-video', job.video) : $emit('open', job.image)"
        >
          <AppIcon name="search" />
          <span class="gallery-action-label">Enlarge</span>
        </button>

        <span class="gallery-action-divider"></span>

        <button
          v-if="job.image && !job.video"
          type="button"
          aria-label="Animate image"
          @click.stop="$emit('animate', job)"
        >
          <AppIcon name="clapperboard" />
          <span class="gallery-action-label">Animate</span>
        </button>

        <span v-if="job.image && !job.video" class="gallery-action-divider"></span>

        <button
          type="button"
          aria-label="Download"
          @click.stop.prevent="$emit('download', job.video || job.image, job.filename)"
        >
          <AppIcon name="download" />
          <span class="gallery-action-label">Download</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue"
import AppIcon from "../ui/AppIcon.vue"

const props = defineProps({
  job: { type: Object, required: true }
})

defineEmits([
  "animate",
  "copy",
  "download",
  "drag-end",
  "drag-start",
  "open",
  "open-video",
  "remove"
])

const isActive = computed(() =>
  props.job.status === "queued" || props.job.status === "generating"
)

const isLocked = computed(() =>
  props.job.status === "generating" || (props.job.shielded && isActive.value)
)
</script>
