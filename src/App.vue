<template lang="pug">
div#wrapper(v-if="loaded")
  aw-header

  main.app-main(:class="{'container': !fullContainer, 'container-fluid': fullContainer}").px-0.px-md-2
    div.aw-container.my-sm-3.mb-3.p-3.p-md-4
      error-boundary
        router-view
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useServerStore } from '~/stores/server';
import { detectPreferredTheme } from '~/util/theme';
// if vite is used, you can import css file as module
//import darkCssUrl from '../static/dark.css?url';
//import darkCssContent from '../static/dark.css?inline';

export default {
  data: function () {
    return {
      activityViews: [],
      loaded: false,
    };
  },

  computed: {
    fullContainer() {
      return this.$route.meta.fullContainer;
    },
  },

  async beforeCreate() {
    // Get Theme From LocalStorage
    const settingsStore = useSettingsStore();
    await settingsStore.ensureLoaded();
    const theme = settingsStore.theme;
    const detectedTheme = theme === 'auto' ? detectPreferredTheme() : theme;

    // Apply the dark theme if detected
    if (detectedTheme === 'dark') {
      const method: 'link' | 'style' = 'link';

      if (method === 'link') {
        // Method 1: Create <link> Element
        // Create Dark Theme Element
        const themeLink = document.createElement('link');
        themeLink.href = '/dark.css'; // darkCssUrl
        themeLink.rel = 'stylesheet';
        // Append Dark Theme Element
        document.querySelector('head').appendChild(themeLink);
      } else {
        // Not supported for Webpack due to not supporting ?inline import in a cross-compatible way (afaik)
        // Method 2: Create <style> Element
        //const style = document.createElement('style');
        //style.innerHTML = darkCssContent;
        //theme === 'dark' ? document.querySelector('head').appendChild(style) : '';
      }
    }
    this.loaded = true;
  },

  mounted: async function () {
    const serverStore = useServerStore();
    await serverStore.getInfo();
  },
};
</script>

<style lang="scss">
html,
body,
#app,
#wrapper {
  min-height: 100%;
}

body {
  background: radial-gradient(circle at 8% 0%, rgba(68, 184, 164, 0.08), transparent 29rem), #f5f8f7;
}

.app-main {
  padding-top: 78px;
}

.app-main .aw-container {
  border: 0;
  border-radius: 18px;
  background: transparent;
}

@media (max-width: 767px) {
  .app-main {
    padding-top: 8px;
  }
}
</style>
