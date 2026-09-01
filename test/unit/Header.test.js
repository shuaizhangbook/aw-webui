import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Header from '~/components/Header.vue';

const mockSetAppLocale = jest.fn();
const passthroughStub = { template: '<div><slot /></div>' };

jest.mock('~/i18n', () => ({
  setAppLocale: locale => mockSetAppLocale(locale),
}));

describe('Claritide header', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockSetAppLocale.mockClear();
  });

  function mountHeader(locale = 'zh-CN') {
    return shallowMount(Header, {
      mocks: {
        $i18n: { locale },
        $t: key => key,
      },
      stubs: {
        'b-navbar': passthroughStub,
        'b-navbar-nav': passthroughStub,
        'b-navbar-brand': passthroughStub,
        icon: passthroughStub,
      },
    });
  }

  test('only exposes the Claritide My Day surface', () => {
    const text = mountHeader().text();

    expect(text).toContain('Claritide');
    expect(text).toContain('nav.myDay');
    expect(text).not.toContain('nav.activity');
    expect(text).not.toContain('nav.timeline');
    expect(text).not.toContain('nav.settings');
  });

  test('offers Chinese and English without technical navigation', () => {
    const buttons = mountHeader().findAll('.language-switch button');

    expect(buttons).toHaveLength(2);
    expect(buttons.at(0).text()).toBe('中文');
    expect(buttons.at(1).text()).toBe('EN');
  });

  test('switches the application locale', async () => {
    const wrapper = mountHeader();

    await wrapper.findAll('.language-switch button').at(1).trigger('click');

    expect(mockSetAppLocale).toHaveBeenCalledWith('en');
  });
});
