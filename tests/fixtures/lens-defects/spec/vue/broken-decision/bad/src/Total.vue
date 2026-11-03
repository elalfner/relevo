<script setup lang="ts">
const props = defineProps<{ amount: number }>();
</script>
<template>
  <span>{{ props.amount.toFixed(0) }}</span>
</template>
