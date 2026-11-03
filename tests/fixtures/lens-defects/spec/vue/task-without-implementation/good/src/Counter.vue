<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
const reset = () => { count.value = 0; };
</script>
<template>
  <button @click="count++">{{ count }}</button>
  <button @click="reset">Reset</button>
</template>
