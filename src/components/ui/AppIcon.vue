<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'brush'">
      <path d="M18.5 3.5 21 6l-9.5 9.5-4 1 1-4L18.5 3.5Z" />
      <path d="M7.5 16.5c-2.6 0-4.5 1.7-4.5 4.5 2.8 0 4.5-1.7 4.5-4.5Z" />
    </template>

    <template v-else-if="name === 'outpaint'">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M3 9V3h6" />
      <path d="M21 15v6h-6" />
      <path d="M3 3l6 6" />
      <path d="M21 21l-6-6" />
    </template>

    <template v-else-if="name === 'reset'">
      <path d="M4 4v6h6" />
      <path d="M4.5 10A8 8 0 1 0 7 5" />
    </template>

    <template v-else-if="name === 'x'">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </template>

    <template v-else-if="name === 'lock'">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </template>

    <template v-else-if="name === 'shield'">
      <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
      <path d="M9 12.5 11 14.5 15.5 10" />
    </template>

    <template v-else-if="name === 'zap'">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </template>

    <template v-else-if="name === 'copy'">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" />
    </template>

    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </template>

    <template v-else-if="name === 'download'">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  name: {
    type: String,
    required: true
  }
})
</script>
