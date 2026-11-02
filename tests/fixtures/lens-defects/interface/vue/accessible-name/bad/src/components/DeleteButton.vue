<script setup lang="ts">
defineEmits<{ (e: 'remove'): void }>();
</script>
<template>
  <button type="button" @click="$emit('remove')">
    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" /></svg>
  </button>
</template>
