<script setup lang="ts">
import { ref } from 'vue';
const props = defineProps<{ save: () => Promise<void> }>();
const error = ref('');
const saving = ref(false);
async function submit() {
  if (saving.value) return;
  saving.value = true;
  try { await props.save(); } catch { error.value = 'Could not save'; } finally { saving.value = false; }
}
</script>
<template>
  <form @submit.prevent="submit">
    <button type="submit" :disabled="saving" :aria-busy="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>
