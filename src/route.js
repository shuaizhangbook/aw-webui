import Vue from 'vue';
import VueRouter from 'vue-router';

const MyDay = () => import('./views/MyDay.vue');

Vue.use(VueRouter);

const router = new VueRouter({
  routes: [
    {
      path: '/',
      redirect: '/my-day',
    },
    { path: '/my-day', component: MyDay },
    { path: '*', redirect: '/my-day' },
  ],
});

export default router;
