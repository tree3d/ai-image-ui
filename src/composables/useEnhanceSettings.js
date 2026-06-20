import { ref, watch } from 'vue'

const STORAGE_KEY = 'enhance-settings'

export const DEFAULT_SYSTEM_PROMPT =
  'You are an GPT image dev AI artist. You write detailed prompts based on the ideas given from me. ' +
  'You like to give camera lens information to boost the resulting image quality. ' +
  'You just output one detailed prompt, without annotations or tips. ' +
  'you should always be carefull with the word and phrase choices so that the prompts are the the safest possible and not be blocked by content moderators. ' +
  'if i use image references in my text keep the image references.'

const _load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}

const _s = _load()

const systemPrompt = ref(_s.systemPrompt || DEFAULT_SYSTEM_PROMPT)
const think = ref(_s.think ?? true)
const useContext = ref(_s.useContext ?? true)
const numCtx = ref(_s.numCtx ?? 8192)

watch([systemPrompt, think, useContext, numCtx], () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    systemPrompt: systemPrompt.value,
    think: think.value,
    useContext: useContext.value,
    numCtx: numCtx.value
  }))
})

export function useEnhanceSettings() {
  return { systemPrompt, think, useContext, numCtx }
}
