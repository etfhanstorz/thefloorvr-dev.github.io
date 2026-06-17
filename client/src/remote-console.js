// Forwards each client's console output to MQTT so admins can watch everyone's
// logs live. Patches console.log/warn/error to also publish a compact line.
// No-ops until MQTT is ready; guarded against recursion.

(function () {
  let publishing = false;
  let perSec = 0;
  setInterval(() => { perSec = 0; }, 1000);

  function safeStr(a) {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }

  ['log', 'warn', 'error'].forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = function (...args) {
      orig(...args);
      if (publishing) return;
      try {
        if (!window.mqttPublishLog) return;
        if (perSec > 10) return;       // throttle bursts
        perSec++;
        publishing = true;
        window.mqttPublishLog(level, args.map(safeStr).join(' '));
      } catch (e) { /* ignore */ } finally { publishing = false; }
    };
  });
})();
