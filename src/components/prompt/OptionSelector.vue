<template>
  <div class="size-block">
    <div class="section-title">{{ title }}</div>
    <div class="size-label">{{ label }}</div>

    <div class="size-grid">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="size-option"
        :class="{ active: modelValue === option.value }"
        @click="$emit('update:modelValue', option.value)"
      >
        <strong>{{ option.label }}</strong>
        <span>{{ option.note }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  modelValue: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    required: true
  }
})

defineEmits(["update:modelValue"])
</script>
