class GoServerTerminal {
  constructor() {
    this.terminal = document.getElementById('gow-terminal');
    if (!this.terminal) return;

    this.lines = [
      "2025/11/27 19:26:14 mōdcræft server v1.0.0",
      "2025/11/27 19:26:14 Built with Go 1.23.3 — no CGO, no telemetry",
      "2025/11/27 19:26:14 Listening on :443 (TLS 1.3, H2, OCSP stapling)",
      "2025/11/27 19:26:14 Serving 12 static files → 1.7 MiB",
      "2025/11/27 19:26:15 Rate limiter: 512 req/s per IP",
      "2025/11/27 19:26:15 Cache warmed — 100% hit ratio",
    ];

    this.requests = [
      "GET / 200 0.9ms — Reykjavík, Iceland",
      "GET /xnn 200 1.1ms — Kyoto, Japan",
      "GET /cube 200 0.8ms — Berlin, Germany",
      "GET /snake 200 1.3ms — São Paulo, Brazil",
      "GET / 200 0.7ms — Helsinki, Finland",
      "WebSocket /live → 11 connections",
      "GET /favicon.png 200 0.4ms — Tallinn, Estonia",
      "Cron: sitemap.xml rebuilt",
      "Health check OK — uptime 312d 14h 33m",
      "GET / 200 1.0ms — Ljubljana, Slovenia",
    ];

    this.rare = [
      "Blocked brute-force attempt from 185.220.101.*",
      "TLS handshake failed — client sent SSLv3",
      "Cache evicted 3 stale entries",
      "Prometheus metrics scraped — 47 series",
    ];

    this.clear();
    this.bootSequence();
  }

  clear() {
    this.terminal.textContent = '';
  }

  write(line) {
    const div = document.createElement('div');
    div.textContent = line;
    this.terminal.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  bootSequence() {
    this.lines.forEach((line, i) => {
      setTimeout(() => this.write(line), i * 600);
    });

    setTimeout(() => {
      this.write('');
      this.write('Server is now live. Accepting connections...');
      this.write('');
      setTimeout(() => this.startTraffic(), 2000);
    }, this.lines.length * 600 + 800);
  }

  startTraffic() {
    const loop = () => {
      if (!this.terminal) return;

      const roll = Math.random();
      let line;

      if (roll < 0.68) {
        line = this.requests[Math.floor(Math.random() * this.requests.length)];
      } else if (roll < 0.92) {
        line = this.requests[Math.floor(Math.random() * 3)]; // repeat recent visitors
      } else {
        line = this.rare[Math.floor(Math.random() * this.rare.length)];
      }

      // Occasionally add timestamp
      if (Math.random() < 0.25) {
        const date = new Date().toISOString().replace('T', ' ').substr(0, 19);
        line = `${date} ${line}`;
      }

      this.write(line);

      const delay = roll < 0.9
        ? 2200 + Math.random() * 3000
        : 8000 + Math.random() * 12000;

      setTimeout(loop, delay);
    };

    loop();
  }
}

// Auto-start when tab opens
document.addEventListener('DOMContentLoaded', () => {
  const screen = document.getElementById('app-gow');
  if (!screen) return;

  let demo = null;

  const observer = new MutationObserver(() => {
    if (screen.classList.contains('active') && !demo) {
      screen.innerHTML = `
        <h2>Go Web Server</h2>
        <p style="text-align:center; opacity:0.7; margin-bottom:1rem;">
          Template for building a Go Webserver
        </p>
        <pre id="gow-terminal" style="margin:0; padding:2rem; height:calc(100% - 7rem); overflow:hidden;
             background:#000; color:#0f8; font-family:'Hack',monospace;
             font-size:clamp(12px,1.6vmin,15px); line-height:1.45;"></pre>
      `;
      demo = new GoServerTerminal();
    }
  });

  observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
});
