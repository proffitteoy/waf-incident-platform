<script setup lang="ts">
import OverviewPanel from "../components/OverviewPanel.vue";
import { dashboardCards } from "../store/dashboard-store";
</script>

<template>
  <main class="page">
    <h1 class="title">WAF Incident Dashboard</h1>
    <p class="subtitle">
      Architecture scaffold aligned with the incident lifecycle pipeline.
    </p>

    <div class="grid">
      <OverviewPanel
        v-for="card in dashboardCards"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :description="card.description"
      />
    </div>
  </main>
</template>
