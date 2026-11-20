<script setup lang="ts">
import { computed } from "vue";
import { clientPriceMinor, money, percent } from "../lib/price";

const props = defineProps<{
  priceMinor: number;
  discountBp: number;
  currency: string;
}>();

const list = computed(() => money(props.priceMinor, props.currency));
const client = computed(() => money(clientPriceMinor(props.priceMinor, props.discountBp), props.currency));
const label = computed(() => percent(props.discountBp));
</script>

<template>
  <div class="price">
    <s v-if="discountBp > 0">{{ list }}</s>
    <strong>{{ client }}</strong>
    <small v-if="discountBp > 0">скидка партнёра {{ label }}</small>
  </div>
</template>
