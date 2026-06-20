<template>
  <div v-if="open" class="modal animate-modal-backdrop" @click.self="$emit('close')">
    <div class="animate-modal">
      <button class="modal-close animate-modal-close" @click="$emit('close')"><span>×</span></button>

      <div class="animate-modal-header">
        <AppIcon name="clapperboard" class="animate-modal-icon" />
        <h2 class="animate-modal-title">Animate Image</h2>
      </div>

      <div class="animate-modal-body">

        <div class="animate-modal-section">
          <span class="animate-modal-label">Model</span>
          <div class="animate-modal-options">
            <button
              class="animate-modal-chip"
              :class="{ active: model === 'grok' }"
              @click="selectModel('grok')"
            >Grok Imagine</button>
            <button
              class="animate-modal-chip animate-modal-chip--seedance"
              :class="{ active: model === 'seedance' }"
              @click="selectModel('seedance')"
            >Seedance 2.0</button>
          </div>
        </div>

        <div v-if="model === 'seedance'" class="animate-modal-warning">
          <span class="animate-modal-warning-icon">⚠</span>
          <span>Seedance 2.0 is significantly more expensive — ~$0.30/sec at 720p, ~$0.68/sec at 1080p. Best for cinematic-quality work.</span>
        </div>

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
              v-for="d in activeDurations"
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
              v-for="r in activeResolutions"
              :key="r"
              class="animate-modal-chip"
              :class="{ active: resolution === r }"
              @click="resolution = r"
            >{{ r }}</button>
          </div>
        </div>

        <div v-if="model === 'seedance'" class="animate-modal-section">
          <span class="animate-modal-label">Speed</span>
          <div class="animate-modal-options">
            <button
              class="animate-modal-chip"
              :class="{ active: !seedanceFast }"
              @click="setSeedanceFast(false)"
            >Standard</button>
            <button
              class="animate-modal-chip"
              :class="{ active: seedanceFast }"
              @click="setSeedanceFast(true)"
            >Fast</button>
          </div>
          <span class="animate-modal-hint">
            {{ seedanceFast ? 'Fast: lower latency, 720p only, ~$0.24/sec' : 'Standard: full quality, up to 1080p, ~$0.30–0.68/sec' }}
          </span>
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
import { ref, computed, watch } from 'vue'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, required: true },
  sourceJob: { type: Object, default: null },
  motionPrompt: { type: String, default: '' }
})

const emit = defineEmits(['close', 'submit'])

const GROK_DURATIONS = [3, 6, 10, 15]
const GROK_RESOLUTIONS = ['480p', '720p']
const SEEDANCE_DURATIONS = [5, 10]
const SEEDANCE_RESOLUTIONS_STANDARD = ['720p', '1080p']
const SEEDANCE_RESOLUTIONS_FAST = ['720p']

const model = ref('grok')
const duration = ref(6)
const resolution = ref('720p')
const localPrompt = ref('')
const seedanceFast = ref(false)

const activeDurations = computed(() =>
  model.value === 'seedance' ? SEEDANCE_DURATIONS : GROK_DURATIONS
)

const activeResolutions = computed(() => {
  if (model.value === 'seedance') {
    return seedanceFast.value ? SEEDANCE_RESOLUTIONS_FAST : SEEDANCE_RESOLUTIONS_STANDARD
  }
  return GROK_RESOLUTIONS
})

const selectModel = (m) => {
  model.value = m
  if (m === 'grok') {
    duration.value = 6
    resolution.value = '720p'
    seedanceFast.value = false
  } else {
    duration.value = 5
    resolution.value = '720p'
  }
}

const setSeedanceFast = (fast) => {
  seedanceFast.value = fast
  if (fast && resolution.value === '1080p') resolution.value = '720p'
}

watch(() => props.open, (v) => {
  if (v) {
    model.value = 'grok'
    duration.value = 6
    resolution.value = '720p'
    localPrompt.value = props.motionPrompt
    seedanceFast.value = false
  }
})

const submit = () => {
  emit('submit', {
    model: model.value,
    duration: duration.value,
    resolution: resolution.value,
    prompt: localPrompt.value,
    seedanceFast: model.value === 'seedance' ? seedanceFast.value : false
  })
  emit('close')
}
</script>
