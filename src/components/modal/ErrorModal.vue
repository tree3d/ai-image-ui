<template>
  <div v-if="open" class="error-modal">
    <div class="error-box">
      <button class="error-close" type="button" @click="$emit('close')">
        <span>x</span>
      </button>
      <h3>Generation Error</h3>
      <pre>{{ message }}</pre>
    </div>
  </div>
</template>

<script setup>
defineProps({
  open: {
    type: Boolean,
    required: true
  },
  message: {
    type: String,
    default: ""
  }
})

defineEmits(["close"])
</script>
