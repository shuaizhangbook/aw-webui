<template lang="pug">
header.app-header.fixed-top
  b-navbar.shell-navbar
    b-navbar-brand.brand(to="/my-day")
      span.brand-mark S
      span.brand-copy
        strong SeeSeeYou
        small Work clearly

    span.current-page
      icon(name="tasks")
      span {{ $t('nav.myDay') }}

    b-navbar-nav.ml-auto.header-actions
      li.language-switch(aria-label="Language")
        button(type="button" :class="{active: currentLocale === 'zh-CN'}" @click="changeLocale('zh-CN')") 中文
        button(type="button" :class="{active: currentLocale === 'en'}" @click="changeLocale('en')") EN
</template>

<script lang="ts">
import 'vue-awesome/icons/tasks';

import { useSettingsStore } from '~/stores/settings';
import { setAppLocale } from '~/i18n';

export default {
  name: 'Header',
  computed: {
    currentLocale(): string {
      return String(this.$i18n.locale);
    },
  },
  methods: {
    changeLocale(locale: 'zh-CN' | 'en') {
      setAppLocale(locale);
      useSettingsStore().$patch({ locale });
    },
  },
};
</script>

<style lang="scss" scoped>
.app-header {
  z-index: 1030;
  width: 100%;
  border-bottom: 1px solid rgba(26, 61, 58, 0.09);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 30px rgba(26, 61, 58, 0.04);
  backdrop-filter: blur(18px);
}

.shell-navbar {
  width: min(1320px, calc(100% - 32px));
  min-height: 68px;
  margin: 0 auto;
  padding: 8px 0;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-right: 34px;
  color: #173635 !important;
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: linear-gradient(145deg, #0d9588, #08675f);
  box-shadow: 0 8px 22px rgba(13, 143, 131, 0.24);
  color: white;
  font-size: 19px;
  font-weight: 900;
}

.brand-copy {
  display: grid;
  line-height: 1.05;
}

.brand-copy strong {
  font-size: 16px;
  letter-spacing: -0.02em;
}

.brand-copy small {
  margin-top: 4px;
  color: #82908f;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.current-page {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border-radius: 10px;
  background: #edf8f5;
  color: #08796f;
  font-size: 13px;
  font-weight: 750;
}

.header-actions ::v-deep .nav-link {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  padding: 9px 13px !important;
  border-radius: 10px;
  color: #647573 !important;
  font-size: 13px;
  font-weight: 750;
}

.header-actions {
  align-items: center;
  gap: 10px;
}

.language-switch {
  display: flex;
  padding: 3px;
  border: 1px solid #dce8e5;
  border-radius: 10px;
  background: #f5f9f8;
}

.language-switch button {
  min-width: 42px;
  padding: 6px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #7c8b89;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.language-switch button.active {
  background: #fff;
  box-shadow: 0 3px 10px rgba(27, 63, 59, 0.1);
  color: #08796f;
}

@media (max-width: 767px) {
  .app-header.fixed-top {
    position: sticky;
  }

  .shell-navbar {
    width: min(100% - 24px, 1320px);
  }

  .language-switch {
    margin-left: auto;
  }

  .brand-copy {
    display: none;
  }

  .brand {
    margin-right: 12px;
  }
}
</style>
