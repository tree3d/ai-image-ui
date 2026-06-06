<template>
  <div class="gallery-toolbar">
    <button class="purge-btn" type="button" @click="$emit('purge')">
      Clear Preview Images
    </button>
  </div>
</template>

<script setup>
defineEmits(["purge"])
</script>
