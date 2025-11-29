document.addEventListener('DOMContentLoaded', () => {
  const screen = document.getElementById('app-dr0id');
  const bottom = document.getElementById('bottom-dr0id');
  if (!screen || !bottom) return;

  let canvas, ctx, analyser, osc, gain, audioCtx;
  let isPlaying = false;
  const barLevel = new Float32Array(128);
  const barPeak = new Float32Array(128);

  const observer = new MutationObserver(() => {
    if (screen.classList.contains('active')) {
      // CREATE CANVAS
      screen.innerHTML = '';
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.background = '#000';
      screen.appendChild(canvas);
      ctx = canvas.getContext('2d');

      // RESIZE
      const resize = () => {
        const rect = screen.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) * 0.95;
        canvas.width = size;
        canvas.height = size;
      };
      resize();
      new ResizeObserver(resize).observe(screen);

      // BUTTONS
      bottom.innerHTML = `
        <button class="control-btn">Start</button>
        <button class="control-btn">Stop</button>
        <div style="flex:1"></div>
        <span style="color:#5599FF;font-size:0.9rem;">DR0ID – Audio Visuals</span>
      `;

      bottom.querySelectorAll('.control-btn').forEach((btn, i) => {
        btn.onclick = () => {
          if (i === 0) start();
          if (i === 1) stop();
        };
      });

      const start = () => {
        if (isPlaying) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32768;
        analyser.smoothingTimeConstant = 0;

        osc = audioCtx.createOscillator();
        gain = audioCtx.createGain();
        gain.gain.value = 0.002; // quiet

        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.connect(analyser);
        osc.start();

        isPlaying = true;
        sweep();
      };

      const stop = () => {
        if (!isPlaying) return;
        osc.stop();
        audioCtx.close();
        isPlaying = false;
        barLevel.fill(0);
        barPeak.fill(0);
      };

      const sweep = () => {
        if (!isPlaying) return;
        const now = audioCtx.currentTime;
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(40, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 6);
        osc.frequency.exponentialRampToValueAtTime(40, now + 12);
        setTimeout(sweep, 12000);
      };

      const render = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!isPlaying || !analyser) {
          requestAnimationFrame(render);
          return;
        }

        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);
        const len = Math.min(2048, data.length);
        const barStartX = (canvas.width - 128 * 14) / 2;

        for (let i = 0; i < 128; i++) {
          let energy = 0;
          const start = (i * len) / 128;
          const end = ((i + 1) * len) / 128;
          for (let j = Math.floor(start); j < Math.floor(end); j++) {
            energy += Math.abs(data[j] - 128) ** 2;
          }
          energy = Math.sqrt(energy / (end - start));
          const target = energy * (canvas.height * 0.2) / 128;

          if (target > barLevel[i]) barLevel[i] = target;
          else barLevel[i] = barLevel[i] * 0.93 + target * 0.07;
          if (target > barPeak[i]) barPeak[i] = target;
          else barPeak[i] *= 0.99;

          const x = barStartX + i * 14;
          const bh = barLevel[i];
          const ph = barPeak[i];

          ctx.fillStyle = 'rgba(22,22,44,0.4)';
          ctx.fillRect(x - 3, canvas.height - bh - 30, 20, bh + 60);
          ctx.fillStyle = 'rgba(55,99,155,0.85)';
          ctx.fillRect(x + 2, canvas.height - bh, 10, bh);
          ctx.fillStyle = '#5599FF';
          ctx.fillRect(x + 2, canvas.height - ph - 3, 10, 6);
        }

        // Dual oscilloscope
        ctx.strokeStyle = '#5599FF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const v = (data[i] - 128) / 128;
          const x = (i / len) * canvas.width;
          const y = canvas.height / 2 * (1 - v * 0.16);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(180,0,0,0.7)';
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const v = (data[i] - 128) / 128;
          const x = (i / len) * canvas.width;
          const y = canvas.height / 2 * (1 + v * 0.16);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        requestAnimationFrame(render);
      };

      requestAnimationFrame(render);
    }
  });

  observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
});
