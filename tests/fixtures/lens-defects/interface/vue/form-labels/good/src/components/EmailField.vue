<script setup lang="ts">
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';

const model = defineModel<string>({ default: '' });
const id = useId();
const { t } = useI18n();
</script>
<template>
  <label :for="id">{{ t('form.email') }}</label>
  <input :id="id" v-model="model" type="email" autocomplete="email">
</template>
