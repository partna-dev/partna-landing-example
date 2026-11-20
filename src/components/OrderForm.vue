<script setup lang="ts">
import { onMounted, ref } from "vue";
import { money } from "../lib/price";

type LeadResponse = {
  leadId: string;
  priceMinor: number;
  discountMinor: number;
  clientPriceMinor: number;
  discountBp: number;
  certificateMinor: number;
  certificateLeftMinor: number;
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
const STORAGE_KEY = "partna-example-lead-key";

const name = ref("");
const contact = ref("");
const certificate = ref("");
const pending = ref(false);
const error = ref("");
const result = ref<LeadResponse | null>(null);
const idempotencyKey = ref("");

onMounted(() => {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    idempotencyKey.value = stored;
    return;
  }
  idempotencyKey.value = `lead-${crypto.randomUUID()}`;
  sessionStorage.setItem(STORAGE_KEY, idempotencyKey.value);
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
        "Idempotency-Key": idempotencyKey.value,
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

function startNew() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.setItem(STORAGE_KEY, `lead-${crypto.randomUUID()}`);
  idempotencyKey.value = sessionStorage.getItem(STORAGE_KEY) || "";
  result.value = null;
  error.value = "";
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
    <button type="submit" :disabled="pending || !idempotencyKey">
      {{ pending ? "Отправляем" : "Оставить заявку" }}
    </button>
  </form>

  <p v-if="error" class="alert">{{ error }}</p>

  <section v-if="result" class="result">
    <h2>Заявка принята</h2>
    <div class="breakdown">
      <div><span>Цена без скидки</span><span>{{ money(result.priceMinor, currency) }}</span></div>
      <div><span>Скидка партнёра</span><span>{{ money(result.discountMinor, currency) }} · {{ result.discountBp / 100 }}%</span></div>
      <div><span>Цена со скидкой</span><span>{{ money(result.clientPriceMinor, currency) }}</span></div>
      <div><span>Оплачено сертификатом</span><span>{{ money(result.certificateMinor, currency) }}</span></div>
      <div><span>Осталось на сертификате</span><span>{{ money(result.certificateLeftMinor, currency) }}</span></div>
      <div><span>К оплате владельцу</span><span>{{ money(result.dueMinor, currency) }}</span></div>
    </div>
    <p class="note">
      Эти суммы посчитал сервер, а не страница. Так же их посчитает владелец при оплате.
      <span v-if="result.duplicate">
        Это повтор с тем же ключом: вернулся прежний ответ, второго начисления не будет.
      </span>
    </p>
    <p class="note">Что сервер отправит в мост:</p>
    <pre>{{ JSON.stringify(result.facts, null, 2) }}</pre>
    <button type="button" class="secondary" @click="startNew">Новая заявка</button>
  </section>
</template>
