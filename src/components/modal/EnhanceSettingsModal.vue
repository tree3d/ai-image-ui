<template>
  <div v-if="open" class="modal enhance-settings-backdrop" @click.self="$emit('close')">
    <div class="enhance-settings-modal">
      <button class="modal-close enhance-settings-close" type="button" @click="$emit('close')">
        <span>×</span>
      </button>

      <div class="enhance-settings-header">
        <AppIcon name="settings" class="enhance-settings-icon" />
        <h2 class="enhance-settings-title">Enhance Settings</h2>
      </div>

      <div class="enhance-settings-body">

        <div class="enhance-settings-field">
          <div class="enhance-settings-label-row">
            <label class="enhance-settings-label">System Prompt</label>
            <button
              class="enhance-settings-reset-btn"
              type="button"
              :disabled="systemPrompt === DEFAULT_SYSTEM_PROMPT"
              @click="systemPrompt = DEFAULT_SYSTEM_PROMPT"
            >Reset to default</button>
          </div>
          <textarea
            v-model="systemPrompt"
            class="enhance-settings-textarea"
            placeholder="System prompt…"
            rows="7"
          />
        </div>

        <div class="enhance-settings-toggles">

          <div class="enhance-settings-toggle-row">
            <div class="enhance-settings-toggle-info">
              <span class="enhance-settings-toggle-label">Thinking mode</span>
              <span class="enhance-settings-toggle-desc">Gemma reasons step-by-step before answering</span>
            </div>
            <button
              class="toggle-pill"
              :class="{ on: think }"
              type="button"
              @click="think = !think"
            ><span class="toggle-knob" /></button>
          </div>

          <div class="enhance-settings-toggle-row">
            <div class="enhance-settings-toggle-info">
              <span class="enhance-settings-toggle-label">Extended context</span>
              <span class="enhance-settings-toggle-desc">Increase token window for longer prompts / images</span>
            </div>
            <button
              class="toggle-pill"
              :class="{ on: useContext }"
              type="button"
              @click="useContext = !useContext"
            ><span class="toggle-knob" /></button>
          </div>

          <div v-if="useContext" class="enhance-settings-ctx-row">
            <label class="enhance-settings-ctx-label">Context tokens</label>
            <input
              v-model.number="numCtx"
              type="number"
              class="enhance-settings-ctx-input"
              min="512"
              max="131072"
              step="512"
            />
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppIcon from '../ui/AppIcon.vue'
import { useEnhanceSettings, DEFAULT_SYSTEM_PROMPT } from '../../composables/useEnhanceSettings'

defineProps({ open: { type: Boolean, required: true } })
defineEmits(['close'])

const { systemPrompt, think, useContext, numCtx } = useEnhanceSettings()
</script>
