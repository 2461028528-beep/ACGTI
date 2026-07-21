<template>
  <main class="home-page">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-copy">
        <h1 id="home-title">LYSG 性格测试</h1>
        <p class="subtitle">墙头马上摇香菇，测测你是哪位主。</p>
      </div>

      <figure class="hero-image-card">
        <img src="/images/lysg-home-hero.png" alt="宫墙、白马、蘑菇和宫殿" />
      </figure>

      <RouterLink to="/quiz" class="start-button">开始测试</RouterLink>
      <p class="small-note">LYSG = 兰因絮果</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useSeo } from '../composables/useSeo'

useSeo({
  title: 'LYSG 性格测试｜测测你是哪位主',
  description: '墙头马上摇香菇，测测你是哪位主。',
  path: '/',
  image: '/images/lysg-home-hero.png',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '大如传测试',
    alternateName: 'LYSG 性格测试',
    url: 'https://acgti.tianxingleo.top',
    description: '墙头马上摇香菇，测测你是哪位主。',
    potentialAction: {
      '@type': 'TakeAction',
      target: 'https://acgti.tianxingleo.top/quiz',
      name: '开始测试',
    },
  },
})
</script>

<style scoped>
.home-page {
  min-height: inherit;
  display: flex;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0) 36%),
    #f6f4ee;
  color: #1f3d34;
}

.home-hero {
  flex: 1;
  width: min(980px, 100%);
  margin: 0 auto;
  padding: clamp(26px, 4vw, 46px) 20px clamp(28px, 4vw, 44px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.home-copy h1 {
  margin: 0;
  color: #1f3d34;
  font-size: clamp(48px, 7vw, 64px);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: 0;
}

.subtitle {
  margin: 16px 0 0;
  color: #718078;
  font-size: clamp(18px, 2.4vw, 22px);
  line-height: 1.6;
  font-weight: 600;
}

.hero-image-card {
  width: min(860px, 92%);
  margin: clamp(24px, 4.2vh, 38px) auto clamp(24px, 4vh, 34px);
  padding: clamp(8px, 1.6vw, 14px);
  border-radius: 26px;
  background: rgba(255, 252, 244, 0.78);
  border: 1px solid rgba(31, 61, 52, 0.08);
  box-shadow: 0 14px 34px rgba(31, 61, 52, 0.09);
}

.hero-image-card img {
  width: 100%;
  max-height: min(46vh, 520px);
  display: block;
  border-radius: 20px;
  object-fit: contain;
}

.start-button {
  width: min(260px, 68vw);
  min-height: 56px;
  padding: 0 30px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #33a474;
  color: #ffffff;
  text-decoration: none;
  font-size: 18px;
  font-weight: 800;
  box-shadow: 0 14px 28px rgba(51, 164, 116, 0.22);
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.start-button:hover {
  background: #2e9469;
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgba(51, 164, 116, 0.26);
}

.start-button:active {
  transform: translateY(0);
  box-shadow: 0 10px 22px rgba(51, 164, 116, 0.2);
}

.small-note {
  margin: 14px 0 0;
  color: #718078;
  font-size: 14px;
  font-weight: 700;
}

@media (max-width: 640px) {
  .home-page {
    min-height: calc(100dvh - 50px);
    align-items: center;
    justify-content: center;
  }

  .home-hero {
    flex: 0 1 auto;
    min-height: auto;
    justify-content: center;
    padding: 16px 12px;
  }

  .home-copy h1 {
    font-size: clamp(36px, 10vw, 40px);
    line-height: 1.1;
  }

  .subtitle {
    margin-top: 10px;
    font-size: clamp(15px, 4.3vw, 17px);
    line-height: 1.5;
  }

  .hero-image-card {
    width: calc(100% - 28px);
    margin: 18px auto 22px;
    padding: 8px;
    border-radius: 20px;
  }

  .hero-image-card img {
    height: 192px;
    max-height: none;
    border-radius: 16px;
    object-fit: contain;
  }

  .start-button {
    width: min(72vw, 280px);
    min-height: 52px;
    font-size: 17px;
  }

  .small-note {
    margin-top: 10px;
  }
}

@media (max-width: 380px) {
  .hero-image-card img {
    height: 178px;
  }
}
</style>
