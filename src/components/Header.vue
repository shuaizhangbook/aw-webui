<template lang="pug">
header.app-header(:class="{'fixed-top': fixedTopMenu}")
  b-navbar.shell-navbar(toggleable="md")
    b-navbar-brand.brand(to="/my-day")
      span.brand-mark S
      span.brand-copy
        strong SeeSeeYou
        small Work clearly

    b-navbar-toggle(target="main-navigation" aria-label="Toggle navigation")

    b-collapse#main-navigation(is-nav)
      b-navbar-nav.primary-navigation
        b-nav-item(to="/my-day")
          icon(name="tasks")
          span {{ $t('nav.myDay') }}

        b-nav-item(v-if="activityViews && activityViews.length === 1" :to="activityViews[0].pathUrl")
          icon(name="chart-line")
          span {{ $t('nav.activity') }}

        b-nav-item-dropdown(v-else no-caret)
          template(slot="button-content")
            icon(name="chart-line")
            span {{ $t('nav.activity') }}
            span.nav-chevron ▾
          b-dropdown-item(v-if="activityViews === null" disabled) {{ $t('nav.loading') }}
          b-dropdown-item(v-else-if="activityViews.length === 0" disabled)
            | {{ $t('nav.noActivityReports') }}
          b-dropdown-item(v-for="view in activityViews" :key="view.name" :to="view.pathUrl")
            icon(:name="view.icon")
            span {{ view.name }}

        b-nav-item(to="/timeline")
          icon(name="stream")
          span {{ $t('nav.timeline') }}

      b-navbar-nav.ml-auto.header-actions
        li.language-switch(aria-label="Language")
          button(type="button" :class="{active: currentLocale === 'zh-CN'}" @click="changeLocale('zh-CN')") 中文
          button(type="button" :class="{active: currentLocale === 'en'}" @click="changeLocale('en')") EN
        b-nav-item.settings-link(to="/settings" :title="$t('nav.settings')")
          icon(name="cog")
          span.d-md-none {{ $t('nav.settings') }}
</template>

<script lang="ts">
import 'vue-awesome/icons/tasks';
import 'vue-awesome/icons/chart-line';
import 'vue-awesome/icons/stream';
import 'vue-awesome/icons/cog';
import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import _ from 'lodash';
import { useBucketsStore } from '~/stores/buckets';
import { useSettingsStore } from '~/stores/settings';
import { setAppLocale } from '~/i18n';
import { IBucket } from '~/util/interfaces';

export default {
  name: 'Header',
  data() {
    return {
      activityViews: null,
      fixedTopMenu: true,
    };
  },
  computed: {
    currentLocale(): string {
      return String(this.$i18n.locale);
    },
  },
  async mounted() {
    const bucketStore = useBucketsStore();
    await bucketStore.ensureLoaded();
    const buckets: IBucket[] = bucketStore.buckets;
    const typesByHost: Record<string, { afk?: boolean; window?: boolean; android?: boolean }> = {};
    const activityViews: { name: string; pathUrl: string; icon: string }[] = [];

    _.each(buckets, bucket => {
      typesByHost[bucket.hostname] = typesByHost[bucket.hostname] || {};
      typesByHost[bucket.hostname].afk ||= bucket.type === 'afkstatus';
      typesByHost[bucket.hostname].window ||= bucket.type === 'currentwindow';
      typesByHost[bucket.hostname].android ||=
        bucket.type === 'currentwindow' && bucket.id.includes('android');
    });

    _.each(typesByHost, (types, hostname) => {
      if (types.android) {
        activityViews.push({
          name: `${hostname} (Android)`,
          pathUrl: `/activity/${hostname}`,
          icon: 'mobile',
        });
      } else if (hostname !== 'unknown') {
        activityViews.push({
          name: hostname,
          pathUrl: `/activity/${hostname}`,
          icon: 'desktop',
        });
      }
    });

    this.activityViews = activityViews;
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

.primary-navigation {
  gap: 5px;
  align-items: center;
}

.primary-navigation ::v-deep .nav-link,
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

.primary-navigation ::v-deep .nav-link:hover,
.primary-navigation ::v-deep .router-link-active {
  background: #edf8f5;
  color: #08796f !important;
}

.nav-chevron {
  margin-left: 2px;
  font-size: 10px;
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

.settings-link ::v-deep .nav-link {
  justify-content: center;
}

@media (max-width: 767px) {
  .app-header.fixed-top {
    position: sticky;
  }

  .shell-navbar {
    width: min(100% - 24px, 1320px);
  }

  .primary-navigation,
  .header-actions {
    align-items: stretch;
    padding: 10px 0;
  }

  .language-switch {
    width: max-content;
    margin: 5px 12px;
  }
}
</style>
