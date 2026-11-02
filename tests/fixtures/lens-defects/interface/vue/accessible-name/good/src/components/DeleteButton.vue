<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineEmits<{ (e: 'remove'): void }>();
const { t } = useI18n();
</script>
<template>
  <button type="button" :aria-label="t('item.delete')" @click="$emit('remove')">
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" /></svg>
  </button>
</template>
