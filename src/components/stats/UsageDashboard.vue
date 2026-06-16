<template>
  <div class="usage-dashboard">
    <div class="usage-chips">
      <div class="usage-chip">
        <span class="chip-label">{{ lastDayLabel }}</span>
        <span class="chip-value" :class="{ loading: pending }">{{ fmtCost(stats?.lastDayCost) }}</span>
        <span class="chip-sub" v-if="stats?.estRecentImgsPerDay != null">~{{ stats.estRecentImgsPerDay }} imgs/day</span>
      </div>
      <div class="usage-chip">
        <span class="chip-label">This month</span>
        <span class="chip-value" :class="{ loading: pending }">{{ fmtCost(stats?.monthCost) }}</span>
        <span class="chip-sub" v-if="stats?.estMonthImages != null">~{{ stats.estMonthImages }} imgs</span>
      </div>
      <div class="usage-chip">
        <span class="chip-label">{{ peakDayLabel }}</span>
        <span class="chip-value" :class="{ loading: pending }">{{ fmtCost(stats?.peakDayCost) }}</span>
      </div>
      <div class="usage-chip">
        <span class="chip-label">Avg / day</span>
        <span class="chip-value" :class="{ loading: pending }">{{ fmtCost(stats?.avgPerDay) }}</span>
      </div>
      <button class="usage-refresh" :disabled="pending" @click="load" title="Refresh stats">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </div>
    <div v-if="error" class="usage-error">{{ error }}</div>
    <div v-if="stats?.dailyCosts?.length" class="usage-sparkline">
      <svg :width="sparkW" height="28" class="sparkline-svg">
        <polyline :points="sparkPoints" fill="none" stroke="rgba(168,85,247,0.75)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle v-for="(p, i) in sparkDots" :key="i" :cx="p.x" :cy="p.y" r="2" fill="#a855f7"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from '../../api/client'

const stats = ref(null)
const pending = ref(false)
const error = ref(null)

async function load() {
  pending.value = true
  error.value = null
  try {
    const res = await api.get('/usage-stats')
    stats.value = res.data
  } catch (err) {
    error.value = err?.response?.data?.error || err.message || 'Failed to load stats'
  } finally {
    pending.value = false
  }
}

onMounted(load)

function fmtCost(v) {
  if (v == null || pending.value) return '—'
  const n = Number(v)
  if (!isFinite(n)) return '—'
  return '$' + n.toFixed(n >= 1 ? 2 : 4)
}

function fmtDayLabel(ts, prefix) {
  if (!ts) return prefix
  const date = new Date(ts * 1000)
  const month = date.toLocaleString('en', { month: 'short', timeZone: 'UTC' })
  const day = date.getUTCDate()
  return `${prefix} (${month} ${day})`
}

const lastDayLabel = computed(() => fmtDayLabel(stats.value?.lastDayTs, 'Last day'))
const peakDayLabel = computed(() => fmtDayLabel(stats.value?.peakDayTs, 'Peak day'))

const sparkW = 120

const sparkPoints = computed(() => {
  const costs = stats.value?.dailyCosts
  if (!costs?.length) return ''
  const max = Math.max(...costs.map(d => d.cost), 0.0001)
  return costs.map((d, i) => {
    const x = (i / (costs.length - 1 || 1)) * (sparkW - 8) + 4
    const y = 24 - (d.cost / max) * 20
    return `${x},${y}`
  }).join(' ')
})

const sparkDots = computed(() => {
  const costs = stats.value?.dailyCosts
  if (!costs?.length) return []
  const max = Math.max(...costs.map(d => d.cost), 0.0001)
  return costs.map((d, i) => ({
    x: (i / (costs.length - 1 || 1)) * (sparkW - 8) + 4,
    y: 24 - (d.cost / max) * 20
  }))
})
</script>
