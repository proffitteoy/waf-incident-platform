<script setup lang="ts">
import { onMounted, ref } from "vue";
import OverviewPanel from "../components/OverviewPanel.vue";
import { apiGet } from "../utils/api-client";
import {
  buildDashboardCards,
  loadingDashboardCards,
  type DashboardCard,
  type DashboardOverviewResponse
} from "../store/dashboard-store";

const dashboardCards = ref<DashboardCard[]>(loadingDashboardCards);
const isLoading = ref(true);
const errorMessage = ref("");

const loadDashboard = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const overview = await apiGet<DashboardOverviewResponse>("/dashboard/overview?range=24h");
    dashboardCards.value = buildDashboardCards(overview);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Failed to load dashboard data";
    dashboardCards.value = loadingDashboardCards;
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <main class="page">
    <h1 class="title">WAF Incident Dashboard</h1>
    <p v-if="isLoading" class="subtitle">Loading live dashboard metrics.</p>
    <p v-else-if="errorMessage" class="subtitle">Failed to load dashboard data: {{ errorMessage }}</p>
    <p v-else class="subtitle">Live metrics sourced from the backend overview API.</p>

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
