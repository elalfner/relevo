<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const model = defineModel<string>({ default: '' });
const { t } = useI18n();
</script>
<template>
  <input v-model="model" type="email" :placeholder="t('form.email')" autocomplete="email">
</template>
