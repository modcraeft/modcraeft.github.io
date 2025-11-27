class Matrix {
    constructor(rows, cols) {
        this.rows = rows; this.cols = cols;
        this.data = new Float32Array(rows * cols);
    }
    fill(v) { this.data.fill(v); }
    random(lo, hi) { for (let i = 0; i < this.data.length; i++) this.data[i] = lo + Math.random() * (hi - lo); }
    add(m) { for (let i = 0; i < this.data.length; i++) this.data[i] += m.data[i]; }
    static dot(c, a, b) {
        for (let i = 0; i < a.rows; i++)
            for (let j = 0; j < b.cols; j++) {
                let sum = 0;
                for (let k = 0; k < a.cols; k++) sum += a.data[i * a.cols + k] * b.data[k * b.cols + j];
                c.data[i * c.cols + j] = sum;
            }
    }
}

class Network {
    constructor(arch) {
        this.arch = arch; this.L = arch.length;
        this.w = []; this.b = []; this.a = [];
        for (let i = 1; i < this.L; i++) {
            this.w.push(new Matrix(arch[i], arch[i - 1]));
            this.b.push(new Matrix(arch[i], 1));
            this.a.push(new Matrix(arch[i], 1));
        }
        this.a.unshift(new Matrix(arch[0], 1));
        this.randomize();
    }
    randomize() {
        for (let i = 0; i < this.w.length; i++) {
            const fanIn = this.w[i].cols;
            const limit = Math.sqrt(2 / fanIn);
            this.w[i].random(-limit, limit);
            this.b[i].random(-0.1, 0.1);
        }
    }
    forward(x, y) {
        this.a[0].data[0] = x; this.a[0].data[1] = y;
        for (let l = 0; l < this.w.length; l++) {
            Matrix.dot(this.a[l + 1], this.w[l], this.a[l]);
            this.a[l + 1].add(this.b[l]);
            if (l < this.w.length - 1) {
                for (let j = 0; j < this.a[l + 1].data.length; j++)
                    this.a[l + 1].data[j] = Math.max(0, this.a[l + 1].data[j]); // ReLU
            } else {
                for (let j = 0; j < this.a[l + 1].data.length; j++)
                    this.a[l + 1].data[j] = 1 / (1 + Math.exp(-this.a[l + 1].data[j])); // sigmoid
            }
        }
        return this.a[this.L - 1].data[0];
    }
}

class XNNDemo {
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.imageRendering = 'pixelated';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.ui = document.createElement('div');

		this.ui.style.cssText = `
			position:absolute;
			top:17%; left:50%;
			transform:translate(-50%,-62%);
			z-index:10;
			background:rgba(0,0,0,0.19);
			padding:12px 18px;
			border:1px solid #5599FF40;
			border-radius:10px;
			color:#88ccff;
			font-family:'Hack',monospace;
			font-size:clamp(13px,2.1vmin,19px);
			font-weight:500;
			text-align:center;
			user-select:none;
			pointer-events:none;
			line-height:1.5;
			text-shadow:0 0 10px #5599FF;
			box-shadow:0 6px 24px rgba(0,0,0,0.7);
			backdrop-filter:blur(5px);
		`;


        container.appendChild(this.ui);

        this.paused = false;
        this.fullscreenMode = false;
        this.upscale = 1;
        this.epoch = 0;
        this.cost = 1.0;

        this.BATCH_SIZE = 8;
        this.BATCHES_PER_FRAME = 400;
        this.LR = 0.3;

        this.arch = [2, 32, 32, 1];
        this.net = new Network(this.arch);
        this.grad = new Network(this.arch);

        this.loadImage();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    loadImage() {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = 'img/7.png';
        img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = img.naturalWidth; cv.height = img.naturalHeight;
            const ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, cv.width, cv.height).data;

            this.W = cv.width; this.H = cv.height;
            this.pixels = this.W * this.H;
            this.imgData = new Uint8Array(this.pixels);
            this.inputs = new Float32Array(this.pixels * 2);
            this.targets = new Float32Array(this.pixels);

            for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
                const i = y * this.W + x;
                const v = data[i * 4];
                this.imgData[i] = v;
                this.inputs[i * 2] = x / (this.W - 1);
                this.inputs[i * 2 + 1] = y / (this.H - 1);
                this.targets[i] = v === 0 ? 0 : v / 255;
            }
            this.ui.textContent = 'Training...';
        };
        img.onerror = () => this.ui.textContent = 'Error loading 7.png';
    }

    trainStep() {
        this.grad.w.forEach(m => m.fill(0));
        this.grad.b.forEach(m => m.fill(0));

        for (let b = 0; b < this.BATCH_SIZE; b++) {
            const k = Math.floor(Math.random() * this.pixels);
            const x = this.inputs[k * 2], y = this.inputs[k * 2 + 1];
            const target = this.targets[k];
            this.net.forward(x, y);
            const pred = this.net.a[this.net.L - 1].data[0];
            let delta = (pred - target) * pred * (1 - pred);

            for (let l = this.net.w.length - 1; l >= 0; l--) {
                const prevA = l === 0 ? this.net.a[0] : this.net.a[l];
                const currA = this.net.a[l + 1];
                for (let j = 0; j < this.net.arch[l + 1]; j++) {
                    const dact = (l === this.net.w.length - 1) ? 1 : (currA.data[j] > 0 ? 1 : 0);
                    const delta_j = delta * dact;
                    for (let i = 0; i < this.net.arch[l]; i++) {
                        this.grad.w[l].data[j * this.net.arch[l] + i] += delta_j * prevA.data[i];
                    }
                    this.grad.b[l].data[j] += delta_j;
                }
                if (l > 0) {
                    let next_delta = 0;
                    for (let j = 0; j < this.net.arch[l + 1]; j++) {
                        if (currA.data[j] > 0) next_delta += this.net.w[l].data[j * this.net.arch[l] + 0] * delta;
                    }
                    delta = next_delta;
                }
            }
        }

        for (let l = 0; l < this.net.w.length; l++) {
            for (let i = 0; i < this.net.w[l].data.length; i++)
                this.net.w[l].data[i] -= (this.LR / this.BATCH_SIZE) * this.grad.w[l].data[i];
            for (let i = 0; i < this.net.b[l].data.length; i++)
                this.net.b[l].data[i] -= (this.LR / this.BATCH_SIZE) * this.grad.b[l].data[i];
        }
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) * 0.95;
        this.canvas.width = this.canvas.height = size;
    }

    drawNetwork(x, y, w, h) {
        const layerX = this.arch.map((_, i) => x + w * 0.1 + i * (w * 0.8) / (this.arch.length - 1));
        const cy = y + h / 2;

        for (let l = 0; l < this.arch.length - 1; l++) {
            for (let i = 0; i < this.arch[l]; i++) for (let j = 0; j < this.arch[l + 1]; j++) {
                const weight = this.net.w[l].data[j * this.arch[l] + i];
                const strength = Math.min(1, Math.abs(weight) * 0.8);
                this.ctx.strokeStyle = weight > 0 ? `rgba(85,153,255,${strength})` : `rgba(50,50,50,${strength})`;
                this.ctx.lineWidth = 0.5 + 2 * strength;
                this.ctx.beginPath();
                this.ctx.moveTo(layerX[l], cy + (i - this.arch[l] / 2 + 0.5) * (h * 0.85 / this.arch[l]));
                this.ctx.lineTo(layerX[l + 1], cy + (j - this.arch[l + 1] / 2 + 0.5) * (h * 0.85 / this.arch[l + 1]));
                this.ctx.stroke();
            }
        }

        for (let l = 0; l < this.arch.length; l++) {
            for (let n = 0; n < this.arch[l]; n++) {
                const act = l === 0 ? 0.5 : this.net.a[l].data[n];
                const val = l === this.arch.length - 1 ? act : Math.max(0, act * 0.4);
                const intensity = 40 + 215 * val;
                this.ctx.fillStyle = (l === 0 || l === this.arch.length - 1) ? '#5599FF' : `rgb(${intensity},${intensity + 60},255)`;
                this.ctx.beginPath();
                //this.ctx.arc(layerX[l], cy + (n - this.arch[l] / 2 + 0.5) * (h * 0.85 / this.arch[l]), Math.max(6, 45 / this.arch[l]), 0, Math.PI * 2);

				const baseRadius = 45 / this.arch[l];
				const radius = (l === 0 || l === this.arch.length - 1)
					? baseRadius * 0.35    // input & output ~55% of normal size
					: baseRadius * 0.35;    // hidden layers slightly larger for drama

				this.ctx.arc(
					layerX[l],
					cy + (n - this.arch[l]/2 + 0.5) * (h * 0.85 / this.arch[l]),
					Math.max(3, radius),
					0, Math.PI * 2
				);

                this.ctx.fill();
            }
        }
    }

    renderImage(x, y, size, predict = false, scale = 1) {
        if (!this.imgData) return;
        const dw = this.W * scale, dh = this.H * scale;
        const pw = size / dw, ph = size / dh;
        for (let iy = 0; iy < dh; iy++) for (let ix = 0; ix < dw; ix++) {
            const v = predict ? this.net.forward(ix / (dw - 1), iy / (dh - 1)) * 255
                              : this.imgData[Math.floor(iy / scale) * this.W + Math.floor(ix / scale)];
            this.ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
            this.ctx.fillRect(x + ix * pw, y + iy * ph, pw + 1, ph + 1);
        }
        this.ctx.strokeStyle = '#5599FF55'; this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, size, size);
    }

    render() {
        const s = this.canvas.width;
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, s, s);

        if (!this.imgData) {
            this.ui.textContent = 'Loading img/7.png...';
            return;
        }

        if (this.fullscreenMode) {
            this.renderImage(0, 0, s, true, this.upscale);
            this.ui.innerHTML = `XNN • Fullscreen • Upscale ${this.upscale}×<br>Epoch ${this.epoch} • Cost ${this.cost.toFixed(6)}`;
            return;
        }

        const pad = s * 0.15;
        const netH = s * 0.62;
        const imgSize = (s - pad * 3) / 2.7;

        this.drawNetwork(pad, pad - 30, s - pad * 2, netH);

		const totalWidth = imgSize * 2 + pad;
		const startX = (s - totalWidth) / 2;
		const imgY = s - pad * 1.3 - imgSize;

		this.renderImage(startX, imgY, imgSize, false);                  // original
		this.renderImage(startX + imgSize + pad, imgY, imgSize, true);   // prediction

        this.ui.innerHTML = `Epoch ${this.epoch}<br>Cost ${this.cost.toFixed(6)}<br>Upscale ${this.upscale}×`;
    }

    loop() {
        if (!this.paused && this.imgData) {
            for (let i = 0; i < this.BATCHES_PER_FRAME; i++) this.trainStep();
            this.epoch++;
            if (this.epoch % 40 === 0) {
                let sum = 0;
                for (let i = 0; i < this.pixels; i++) {
                    const out = this.net.forward(this.inputs[i * 2], this.inputs[i * 2 + 1]);
                    sum += (out - this.targets[i]) ** 2;
                }
                this.cost = sum / this.pixels;
            }
        }
        this.render();
        requestAnimationFrame(this.loop);
    }

    togglePause() { this.paused = !this.paused; }
    reset() { this.net.randomize(); this.epoch = 0; this.cost = 1; }
    toggleFullscreen() { this.fullscreenMode = !this.fullscreenMode; }
}


document.addEventListener('DOMContentLoaded', () => {
    const screen = document.getElementById('app-xnn');
    if (!screen) return;

    let demo = null;

    const observer = new MutationObserver(() => {
        if (screen.classList.contains('active')) {
            if (!demo) {
                //screen.innerHTML = '<h2>XNN</h2><p>Neural net learning the 7 digit from (x,y) brightness</p>';
                demo = new XNNDemo(screen);
                window.xnnDemo = demo;
            }
            if (demo && demo.paused) demo.togglePause();
        } else if (demo) {
            demo.togglePause();
        }
    });
    observer.observe(screen, { attributes: true, attributeFilter: ['class'] });

    // Bottom bar controls – fixed syntax!
    document.querySelectorAll('#bottom-xnn .control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!demo) return;

            if (btn.textContent.includes('Pause') || btn.textContent.includes('Resume')) {
                demo.togglePause();
                btn.textContent = demo.paused ? 'Resume' : 'Pause';
            } else if (btn.textContent === 'Reset') {
                demo.reset();
            } else if (btn.textContent === 'Fullscreen') {
                demo.toggleFullscreen();
            }
        });
    });
});
