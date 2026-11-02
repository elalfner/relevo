<script setup lang="ts">
const model = defineModel<string>({ default: '' });
</script>
<template>
  <input v-model="model" type="email" placeholder="Email" autocomplete="email">
</template>
