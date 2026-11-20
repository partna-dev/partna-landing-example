<script setup lang="ts">
import { computed, ref } from "vue";
import { money } from "../lib/price";

type LeadResponse = {
  leadId: string;
  priceMinor: number;
  discountBp: number;
  certificateMinor: number;
  dueMinor: number;
  duplicate: boolean;
  facts: Array<{ method: string; path: string; body: Record<string, unknown> }>;
};

const props = defineProps<{
  serviceId: string;
  currency: string;
  partner: string;
  discountBp: number;
}>();

const apiBase = import.meta.env.PUBLIC_API_BASE || "http://localhost:8787";

const name = ref("");
const contact = ref("");
const certificate = ref("");
const pending = ref(false);
const error = ref("");
const result = ref<LeadResponse | null>(null);

const idempotencyKey = `lead-${crypto.randomUUID()}`;

const due = computed(() => {
  if (!result.value) {
    return "";
  }
  return money(result.value.dueMinor, props.currency);
});

async function submit() {
  pending.value = true;
  error.value = "";
  result.value = null;
  try {
    const response = await fetch(`${apiBase}/api/lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        serviceId: props.serviceId,
        name: name.value,
        contact: contact.value,
        partner: props.partner,
        certificate: certificate.value,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      error.value = body.detail || "Сервер отклонил заявку";
      return;
    }
    result.value = body as LeadResponse;
  } catch (cause) {
    error.value = "Сервер недоступен. Заявка не отправлена.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <label>
      Имя
      <input v-model="name" required maxlength="80" autocomplete="name" />
    </label>
    <label>
      Контакт
      <input v-model="contact" required maxlength="120" autocomplete="email" placeholder="почта или телефон" />
    </label>
    <label>
      Код сертификата, если есть
      <input v-model="certificate" maxlength="24" placeholder="CERT5000" />
    </label>
    <button type="submit" :disabled="pending">
      {{ pending ? "Отправляем" : "Оставить заявку" }}
    </button>
  </form>

  <p v-if="error" class="alert">{{ error }}</p>

  <section v-if="result" class="result">
    <h2>Заявка принята</h2>
    <div class="breakdown">
      <div><span>Цена без скидки</span><span>{{ money(result.priceMinor, currency) }}</span></div>
      <div><span>Скидка партнёра</span><span>{{ result.discountBp / 100 }}%</span></div>
      <div><span>Оплачено сертификатом</span><span>{{ money(result.certificateMinor, currency) }}</span></div>
      <div><span>К оплате владельцу</span><span>{{ due }}</span></div>
    </div>
    <p class="note">
      Эти суммы посчитал сервер, а не страница. Так же их посчитает владелец при оплате.
      <span v-if="result.duplicate">Повтор с тем же ключом вернул прежний ответ и не создал второе начисление.</span>
    </p>
    <p class="note">Что сервер отправит в мост:</p>
    <pre>{{ JSON.stringify(result.facts, null, 2) }}</pre>
  </section>
</template>
