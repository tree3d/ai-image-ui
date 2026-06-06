<template>
  <div class="gallery-scale-box">
    <div class="gallery-scale-header">
      <span>Gallery Size</span>
      <strong>{{ percent }}%</strong>
    </div>

    <input
      :value="modelValue"
      type="range"
      min="0"
      max="1"
      step="0.05"
      class="gallery-scale-slider"
      @input="$emit('update:modelValue', Number($event.target.value))"
    />
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Number,
    required: true
  },
  percent: {
    type: Number,
    required: true
  }
})

defineEmits(["update:modelValue"])
</script>
