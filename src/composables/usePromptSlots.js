import { ref } from 'vue'

const SLOT_COUNT = 5

export function usePromptSlots(storageKey) {
  const activeKey = `${storageKey}-active`

  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey))
      if (Array.isArray(saved) && saved.length === SLOT_COUNT) return saved
    } catch {}
    return Array(SLOT_COUNT).fill('')
  }

  const slots = ref(load())
  const activeIndex = ref(
    Math.min(Math.max(parseInt(localStorage.getItem(activeKey) || '0') || 0, 0), SLOT_COUNT - 1)
  )

  const persist = () => {
    localStorage.setItem(storageKey, JSON.stringify(slots.value))
    localStorage.setItem(activeKey, String(activeIndex.value))
  }

  // Call on every keystroke to keep active slot in sync
  const syncSlot = (text) => {
    slots.value[activeIndex.value] = text
    persist()
  }

  // Save current text, switch to slot i, return the slot's stored text
  const switchSlot = (i, currentText) => {
    if (i === activeIndex.value) return currentText
    slots.value[activeIndex.value] = currentText
    activeIndex.value = i
    persist()
    return slots.value[i]
  }

  // If a slot other than the active one is empty, switch to it and place text there.
  // Saves currentText into the active slot first. Returns text if placed, null if no free slot.
  const fillFreeSlot = (text, currentText) => {
    const freeIdx = slots.value.findIndex((s, i) => i !== activeIndex.value && !s.trim())
    if (freeIdx === -1) return null
    slots.value[activeIndex.value] = currentText
    activeIndex.value = freeIdx
    slots.value[freeIdx] = text
    persist()
    return text
  }

  // Clear the active slot's stored text
  const clearSlot = () => {
    slots.value[activeIndex.value] = ''
    persist()
  }

  return { slots, activeIndex, syncSlot, switchSlot, fillFreeSlot, clearSlot }
}
