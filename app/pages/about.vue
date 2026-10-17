<script setup lang="ts">
useHead({ title: 'О проекте' })
</script>

<template>
  <div class="about">
    <h1 class="about__title">
      О проекте
    </h1>
    <p class="about__lead">
      Сайт для тех, кто хочет просто следить за футболом. Результаты матчей, турнирные таблицы, статистика и расписание — без лишнего шума.
    </p>
    <p class="about__text">
      Никаких новостей о том, что запостила жена футболиста, кто с кем поссорился в раздевалке и какого молодого российского игрока сегодня снова хотят купить Манчестер Юнайтед, ПСЖ или Реал.
    </p>

    <figure class="about__dedication">
      <img
        src="/images/barsik.jpg"
        alt="Барсик"
        width="128"
        height="128"
        class="about__cat"
      >
      <figcaption class="about__caption">
        Этот сайт посвящается моему коту Барсику, которого я очень любил.
      </figcaption>
    </figure>
  </div>
</template>

<style scoped lang="scss">
.about {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    gap: 24px;
  }
}

.about__title {
  font-size: 26px;
  line-height: 1.15;

  @media (min-width: $breakpoint-desktop) {
    font-size: 40px;
  }
}

.about__lead {
  font-size: 16px;
  line-height: 1.6;

  @media (min-width: $breakpoint-desktop) {
    font-size: 18px;
  }
}

.about__text {
  font-size: 15px;
  line-height: 1.6;
  color: $color-text-2;

  @media (min-width: $breakpoint-desktop) {
    font-size: 17px;
  }
}

// Телефон: фото над подписью по центру. Десктоп: фото слева, подпись справа.
.about__dedication {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin: 16px 0 0;
  padding: 20px 16px;
  text-align: center;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card;

  @media (min-width: $breakpoint-desktop) {
    flex-direction: row;
    gap: 24px;
    padding: 24px;
    text-align: left;
  }
}

.about__cat {
  width: 128px;
  height: 128px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 50%;
  background: $color-badge-bg;

  @media (min-width: $breakpoint-desktop) {
    width: 120px;
    height: 120px;
  }
}

.about__caption {
  font-size: 15px;
  line-height: 1.5;
  font-style: italic;
  color: $color-text-2;
}
</style>
