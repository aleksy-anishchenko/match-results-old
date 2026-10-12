<template>
  <div>
    <AppHeader />
    <main class="container page-main">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.page-main {
  padding-top: 20px;
  padding-bottom: 32px;

  @media (min-width: $breakpoint-desktop) {
    padding-top: 40px;
    padding-bottom: 64px;
  }
}
</style>
