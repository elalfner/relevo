<script setup lang="ts">
import { ref } from 'vue';
const props = defineProps<{ save: () => Promise<void> }>();
const error = ref('');
async function submit() {
  try { await props.save(); } catch { error.value = 'Could not save'; }
}
</script>
<template>
  <form @submit.prevent="submit">
    <button type="submit">Save</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>
