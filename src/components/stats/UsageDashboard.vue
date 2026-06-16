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
    <div v-if="bars.length" class="usage-bargraph">
      <div
        v-for="(b, i) in bars"
        :key="i"
        class="usage-bar-col"
        :data-tip="b.label"
      >
        <div class="usage-bar-track">
          <div
            class="usage-bar-fill"
            :style="{ height: b.pct + '%', background: b.color, borderColor: b.borderColor, boxShadow: b.isPeak ? `0 0 10px ${b.color}` : 'none' }"
          ></div>
        </div>
        <span class="usage-bar-day">{{ b.day }}</span>
      </div>
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

// dark blue → green → orange based on usage ratio
function usageColor(ratio, alpha = 1) {
  const blue   = [30,  80,  180]
  const green  = [34, 197,  94]
  const orange = [249, 115,  22]
  let r, g, b
  if (ratio <= 0.5) {
    const t = ratio * 2
    r = Math.round(blue[0] + (green[0] - blue[0]) * t)
    g = Math.round(blue[1] + (green[1] - blue[1]) * t)
    b = Math.round(blue[2] + (green[2] - blue[2]) * t)
  } else {
    const t = (ratio - 0.5) * 2
    r = Math.round(green[0] + (orange[0] - green[0]) * t)
    g = Math.round(green[1] + (orange[1] - green[1]) * t)
    b = Math.round(green[2] + (orange[2] - green[2]) * t)
  }
  return `rgba(${r},${g},${b},${alpha})`
}

const bars = computed(() => {
  const costs = stats.value?.dailyCosts
  if (!costs?.length) return []
  const max = Math.max(...costs.map(d => d.cost), 0.0001)
  return costs.map(d => {
    const ratio = d.cost / max
    const date = new Date(d.ts * 1000)
    return {
      pct: Math.max(ratio * 100, d.cost > 0 ? 4 : 0),
      isPeak: d.cost === max && d.cost > 0,
      color: usageColor(ratio, 0.82),
      borderColor: usageColor(ratio, 0.5),
      day: date.getUTCDate(),
      label: `${date.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${date.getUTCDate()}: $${d.cost.toFixed(2)}`
    }
  })
})
</script>
