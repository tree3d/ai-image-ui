<template>
  <div v-if="open" class="modal" @click="$emit('close')">
    <button class="modal-close" type="button" @click.stop="$emit('close')">
      <span>x</span>
    </button>
    <img :src="src" class="modal-img" @click.stop />
  </div>
</template>

<script setup>
defineProps({
  open: {
    type: Boolean,
    required: true
  },
  src: {
    type: String,
    default: null
  }
})

defineEmits(["close"])
</script>
