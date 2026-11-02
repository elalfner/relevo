<script setup lang="ts">
const model = defineModel<string>({ default: '' });
</script>
<template>
  <label for="email-field">Email</label>
  <input id="email-field" v-model="model" type="email" autocomplete="email">
</template>
