<template>
  <div v-if="open" class="modal animate-modal-backdrop" @click.self="$emit('close')">
    <div class="animate-modal">
      <button class="modal-close animate-modal-close" @click="$emit('close')"><span>×</span></button>

      <div class="animate-modal-header">
        <AppIcon name="clapperboard" class="animate-modal-icon" />
        <h2 class="animate-modal-title">Animate Image</h2>
      </div>

      <div class="animate-modal-body">
        <div class="animate-modal-thumb-wrap">
          <img v-if="sourceJob?.image" :src="sourceJob.image" class="animate-modal-thumb" />
          <textarea
            v-model="localPrompt"
            class="animate-modal-prompt-input"
            placeholder="Describe the motion (e.g. slow camera push in, leaves rustling in wind…)"
            rows="4"
          />
        </div>

        <div class="animate-modal-section">
          <span class="animate-modal-label">Duration</span>
          <div class="animate-modal-options">
            <button
              v-for="d in durationOptions"
              :key="d"
              class="animate-modal-chip"
              :class="{ active: duration === d }"
              @click="duration = d"
            >{{ d }}s</button>
          </div>
        </div>

        <div class="animate-modal-section">
          <span class="animate-modal-label">Resolution</span>
          <div class="animate-modal-options">
            <button
              v-for="r in resolutionOptions"
              :key="r"
              class="animate-modal-chip"
              :class="{ active: resolution === r }"
              @click="resolution = r"
            >{{ r }}</button>
          </div>
        </div>

        <button class="animate-modal-submit" @click="submit">
          <AppIcon name="clapperboard" />
          Animate
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, required: true },
  sourceJob: { type: Object, default: null },
  motionPrompt: { type: String, default: '' }
})

const emit = defineEmits(['close', 'submit'])

const durationOptions = [3, 6, 10, 15]
const resolutionOptions = ['480p', '720p']

const duration = ref(6)
const resolution = ref('720p')
const localPrompt = ref('')

watch(() => props.open, (v) => {
  if (v) {
    duration.value = 6
    resolution.value = '720p'
    localPrompt.value = props.motionPrompt
  }
})

const submit = () => {
  emit('submit', { duration: duration.value, resolution: resolution.value, prompt: localPrompt.value })
  emit('close')
}
</script>
