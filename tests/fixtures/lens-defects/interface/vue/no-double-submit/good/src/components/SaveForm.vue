<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ save: () => Promise<void> }>();
const { t } = useI18n();
const saving = ref(false);
const status = ref<'idle' | 'saved' | 'error'>('idle');

async function submit() {
  if (saving.value) return;
  saving.value = true;
  status.value = 'idle';
  try {
    await props.save();
    status.value = 'saved';
  } catch {
    status.value = 'error';
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <form @submit.prevent="submit">
    <button type="submit" :disabled="saving" :aria-busy="saving">{{ saving ? t('form.saving') : t('form.save') }}</button>
    <p v-if="status === 'saved'" role="status">{{ t('form.saved') }}</p>
    <p v-if="status === 'error'" role="alert">{{ t('form.saveFailed') }}</p>
  </form>
</template>
