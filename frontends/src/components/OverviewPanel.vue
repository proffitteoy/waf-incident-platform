<script setup lang="ts">
defineProps<{
  title: string;
  value: string;
  description: string;
}>();
</script>

<template>
  <div class="panel">
    <h2 class="panel-title">{{ title }}</h2>
    <div class="panel-value">{{ value }}</div>
    <div class="panel-desc">{{ description }}</div>
  </div>
</template>
