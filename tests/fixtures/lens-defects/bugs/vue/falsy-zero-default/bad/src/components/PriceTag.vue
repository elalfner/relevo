<script setup>
import { computed } from 'vue';

const props = defineProps({
  price: { type: Number, default: null },
  fallback: { type: Number, default: 9.99 },
});

// The catalogue sends `price: null` when a product has no price yet; a free product sends 0.
const shown = computed(() => (props.price || props.fallback).toFixed(2));
</script>

<template>
  <span class="price-tag">{{ shown }}</span>
</template>
