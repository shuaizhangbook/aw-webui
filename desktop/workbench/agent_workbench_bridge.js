(function () {
  'use strict';

  var location = window.location || {};
  var trustedTopLevel = window.top === window && !location.port && (
    (location.protocol === 'claritide-agent:' && location.hostname === 'localhost') ||
    (location.protocol === 'http:' && location.hostname === 'claritide-agent.localhost')
  );
  if (!trustedTopLevel) return;

  var internals = window.__TAURI_INTERNALS__;
  if (!internals || typeof internals.invoke !== 'function') return;
  var invoke = internals.invoke;
  var handlers = new Set();
  var pollTimer = null;
  var pollInFlight = false;
  var lastPollError = '';

  function assertObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(name + ' must be an object');
    }
    return value;
  }

  function unsupported(name) {
    var error = new Error(name + ' is not supported by Claritide agent capability v2');
    error.code = 'unsupported';
    return Promise.reject(error);
  }

  function dispatch(event) {
    handlers.forEach(function (handler) {
      try { handler(event); } catch (error) { console.error(error); }
    });
  }

  async function poll() {
    if (pollInFlight || handlers.size === 0) return;
    pollInFlight = true;
    try {
      var events = await invoke('agent_poll_events', { sessionId: null });
      lastPollError = '';
      if (Array.isArray(events)) events.forEach(dispatch);
    } catch (error) {
      var message = error && error.message ? error.message : String(error);
      if (message !== lastPollError) {
        lastPollError = message;
        dispatch({
          eventId: 0,
          sessionId: null,
          type: 'error',
          timestampMs: Date.now(),
          payload: { code: 'event_poll_failed', message: message }
        });
      }
    } finally {
      pollInFlight = false;
    }
  }

  function ensurePolling() {
    if (pollTimer !== null || handlers.size === 0) return;
    pollTimer = window.setInterval(poll, 100);
    void poll();
  }

  function stopPollingIfIdle() {
    if (handlers.size !== 0 || pollTimer === null) return;
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  var bridge = Object.freeze({
    capabilityVersion: 2,
    getStatus: function () {
      return invoke('agent_get_status');
    },
    listModels: async function () {
      var status = await invoke('agent_get_status');
      return Array.isArray(status.allowedModels) ? status.allowedModels : [];
    },
    listSessions: async function () {
      var status = await invoke('agent_get_status');
      return Array.isArray(status.sessions) ? status.sessions : [];
    },
    selectWorkspace: function () {
      return invoke('agent_select_workspace');
    },
    startSession: function (options) {
      return invoke('agent_start', { request: assertObject(options, 'options') });
    },
    send: function (options) {
      return invoke('agent_send', { request: assertObject(options, 'options') });
    },
    stop: function (options) {
      return invoke('agent_interrupt', { request: assertObject(options, 'options') });
    },
    close: function (options) {
      return invoke('agent_close', { request: assertObject(options, 'options') });
    },
    resume: function () {
      return unsupported('resume');
    },
    onEvent: function (handler) {
      if (typeof handler !== 'function') throw new TypeError('handler must be a function');
      handlers.add(handler);
      ensurePolling();
      var subscribed = true;
      return function () {
        if (!subscribed) return;
        subscribed = false;
        handlers.delete(handler);
        stopPollingIfIdle();
      };
    }
  });

  Object.defineProperty(window, '__CLARITIDE_CCB__', {
    value: bridge,
    configurable: false,
    enumerable: false,
    writable: false
  });

  if (window.__CLARITIDE_AGENT_BRIDGE_TEST_MODE__) {
    window.__CLARITIDE_AGENT_BRIDGE_TEST__ = {
      bridge: bridge,
      poll: poll,
      handlerCount: function () { return handlers.size; }
    };
  }
})();
