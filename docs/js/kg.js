document.addEventListener('DOMContentLoaded', () => {
  const screen = document.getElementById('app-kg');
  const bottom = document.getElementById('bottom-kg');
  if (!screen || !bottom) return;

  let canvas, ctx;
  let nodes = [], edges = [];
  let positions = [];

  const observer = new MutationObserver(() => {
    if (screen.classList.contains('active')) {
      screen.innerHTML = '';
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.background = 'transparent';
      screen.appendChild(canvas);
      ctx = canvas.getContext('2d');

      const resize = () => {
        const rect = screen.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) * 0.95;
        canvas.width = size;
        canvas.height = size;
      };
      resize();
      new ResizeObserver(resize).observe(screen);

      // Build graph from current page
      buildGraph();

      // Layout
      fruchtermanReingold(500);

      // Render loop
      const render = () => {
        //ctx.fillStyle = 'rgba(0,0,0,0.02)';
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Edges
        ctx.strokeStyle = '#5599FF11';
        ctx.lineWidth = 1;
        edges.forEach(e => {
          const a = positions[e.from];
          const b = positions[e.to];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });

        // Nodes
        nodes.forEach((node, i) => {
          const p = positions[i];
          const hue = (i * 137) % 360;
          ctx.fillStyle = `hsl(${hue}, 70%, 65%)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
          ctx.fill();

          ctx.fillStyle = '#00FF00';
          ctx.font = '11px Hack';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label, p.x, p.y + 18);
        });

        requestAnimationFrame(render);
      };
      render();
    }
  });

  function buildGraph() {
    nodes = [];
    edges = [];
    const seen = new Map();

    function addNode(el) {
      const tag = el.tagName?.toLowerCase() || 'text';
      const id = el.id ? `#${el.id}` : '';
      const cls = el.classList?.length ? `.${Array.from(el.classList).join('.')}` : '';
      const label = `${tag}${id}${cls}`.slice(0, 18);
      if (!seen.has(label)) {
        const id = nodes.length;
        nodes.push({ label });
        seen.set(label, id);
      }
      return seen.get(label);
    }

    function walk(el, parentId = null) {
      const myId = addNode(el);
      if (parentId !== null) edges.push({ from: parentId, to: myId });
      for (const child of el.children || []) {
        walk(child, myId);
      }
    }

    walk(document.body);
  }

  function fruchtermanReingold(iters) {
    const w = canvas.width, h = canvas.height;
    const area = w * h;
    const k = Math.sqrt(area / nodes.length) * 1.8;

    positions = nodes.map(() => ({
      x: w/2 + (Math.random()-0.5)*300,
      y: h/2 + (Math.random()-0.5)*300
    }));

    let temp = w/10;

    for (let i = 0; i < iters; i++) {
      const disp = positions.map(() => ({x:0,y:0}));

      // Repulsion
      for (let v = 0; v < nodes.length; v++) {
        for (let u = 0; u < nodes.length; u++) {
          if (v === u) continue;
          let dx = positions[v].x - positions[u].x;
          let dy = positions[v].y - positions[u].y;
          let d = Math.hypot(dx, dy) || 1;
          const f = k*k / d;
          disp[v].x += dx/d * f;
          disp[v].y += dy/d * f;
        }
      }

      // Attraction
      for (const e of edges) {
        let dx = positions[e.from].x - positions[e.to].x;
        let dy = positions[e.from].y - positions[e.to].y;
        let d = Math.hypot(dx, dy) || 1;
        const f = d*d / k;
        const fx = dx/d * f;
        const fy = dy/d * f;
        disp[e.from].x -= fx;
        disp[e.from].y -= fy;
        disp[e.to].x += fx;
        disp[e.to].y += fy;
      }

      // Apply
      for (let v = 0; v < positions.length; v++) {
        const d = Math.hypot(disp[v].x, disp[v].y);
        if (d > 0) {
          const f = Math.min(d, temp)/d;
          positions[v].x += disp[v].x * f;
          positions[v].y += disp[v].y * f;
        }
        positions[v].x = Math.max(50, Math.min(w-50, positions[v].x));
        positions[v].y = Math.max(50, Math.min(h-50, positions[v].y));
      }
      temp *= 0.94;
    }
  }

  observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
});
