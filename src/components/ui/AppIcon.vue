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

    <template v-else-if="name === 'ellipsis'">
      <circle cx="5" cy="12" r="1.65" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.65" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.65" fill="currentColor" stroke="none" />
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

    <template v-else-if="name === 'flame'">
      <path d="M12 22c4.2 0 7-3 7-7.2 0-3.1-1.8-5.5-4.8-8.8.2 2.7-1.2 4.1-2.4 4.8.2-3.7-1.7-6.4-4.4-8.8.2 4-2.4 6.1-2.4 10.1C5 17.7 7.8 22 12 22Z" />
      <path d="M9.5 17.2c0 2 1.1 3.3 2.7 3.3s2.8-1.2 2.8-3.1c0-1.4-.7-2.5-1.9-3.8 0 1.3-.7 2-1.3 2.4 0-1.7-.8-2.8-1.9-3.9.1 1.9-.4 3.2-.4 5.1Z" />
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

    <template v-else-if="name === 'clapperboard'">
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2" />
      <path d="M7 5 5 9" />
      <path d="M12 5l-2 4" />
      <path d="M17 5l-2 4" />
    </template>

    <template v-else-if="name === 'wand'">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
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
