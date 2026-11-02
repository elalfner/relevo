<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ save: () => Promise<void> }>();
const { t } = useI18n();
const status = ref<'idle' | 'saved' | 'error'>('idle');

async function submit() {
  status.value = 'idle';
  try {
    await props.save();
    status.value = 'saved';
  } catch {
    status.value = 'error';
  }
}
</script>
<template>
  <form @submit.prevent="submit">
    <button type="submit">{{ t('form.save') }}</button>
    <p v-if="status === 'saved'" role="status">{{ t('form.saved') }}</p>
    <p v-if="status === 'error'" role="alert">{{ t('form.saveFailed') }}</p>
  </form>
</template>
