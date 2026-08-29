import router from '~/route';

describe('router', () => {
  test('root always redirects to My Day', () => {
    const rootRoute = router.options.routes.find(route => route.path === '/');

    localStorage.landingpage = '/work-report';
    expect(rootRoute.redirect).toBe('/my-day');
  });

  test('includes the My Day route', () => {
    const myDayRoute = router.options.routes.find(route => route.path === '/my-day');

    expect(myDayRoute).toBeTruthy();
    expect(typeof myDayRoute.component).toBe('function');
  });

  test('only exposes My Day and redirects every other route', () => {
    const paths = router.options.routes.map(route => route.path);
    const catchAllRoute = router.options.routes.find(route => route.path === '*');

    expect(paths).toEqual(['/', '/my-day', '*']);
    expect(catchAllRoute.redirect).toBe('/my-day');
  });
});
