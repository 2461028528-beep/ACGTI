<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isFirstLoad = ref(true)

const dismissLoading = () => {
  const el = document.getElementById('loading-screen')
  if (el && !el.classList.contains('loaded')) {
    el.classList.add('loaded')
    const remove = () => el.remove()
    el.addEventListener('transitionend', remove, { once: true })
    setTimeout(remove, 600)
  }
}

onMounted(() => {
  requestAnimationFrame(dismissLoading)
})

const onAfterEnter = () => {
  isFirstLoad.value = false
}

const routeTransitionName = computed(() => {
  if (isFirstLoad.value) return ''
  return route.path === '/quiz' ? 'page-fade-static' : 'page-fade'
})
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <RouterLink class="brand-lockup" to="/">大如传测试</RouterLink>
      <RouterLink v-if="route.path !== '/'" class="home-link" to="/">返回首页</RouterLink>
    </header>

    <main class="site-main">
      <router-view v-slot="{ Component }">
        <transition :name="routeTransitionName" mode="out-in" @after-enter="onAfterEnter">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.site-shell {
  min-height: 100dvh;
  background: #f6f4ee;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 56px;
  min-height: 0;
  padding: 0 clamp(16px, 4vw, 42px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(31, 61, 52, 0.08);
  background: rgba(246, 244, 238, 0.88);
  backdrop-filter: blur(14px);
}

.brand-lockup,
.home-link {
  color: #1f3d34;
  text-decoration: none;
  font-weight: 800;
}

.brand-lockup {
  font-size: 18px;
  letter-spacing: 0.02em;
}

.home-link {
  font-size: 14px;
  color: #60736b;
}

.home-link:hover {
  color: #33a474;
}

.site-main {
  min-height: calc(100dvh - 56px);
  background: #f6f4ee;
  padding: 0;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.page-fade-static-enter-active,
.page-fade-static-leave-active {
  transition: opacity 0.12s ease;
}

.page-fade-static-enter-from,
.page-fade-static-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .site-header {
    position: sticky;
    height: 50px;
    min-height: 0;
    justify-content: center;
    padding: 0 12px;
  }

  .brand-lockup {
    font-size: 16px;
  }

  .home-link {
    display: none;
  }

  .site-main {
    min-height: calc(100dvh - 50px);
    padding: 0;
  }
}
</style>
