class AISnakeGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.GRID_SIZE = 28;
        this.resizeCanvas();

        this.reset();
        this.running = false;
        this.flash = 0;

        this.loop = this.loop.bind(this);

        new ResizeObserver(() => this.resizeCanvas()).observe(canvas.parentElement);
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * 0.95;
        this.canvas.height = rect.height * 0.95;

        this.CELL_SIZE = Math.floor(Math.min(this.canvas.width, this.canvas.height) / this.GRID_SIZE);
        this.GRID_DIM = this.CELL_SIZE * this.GRID_SIZE;
        this.offsetX = (this.canvas.width - this.GRID_DIM) / 2;
        this.offsetY = (this.canvas.height - this.GRID_DIM) / 2;
    }

    reset() {
        this.direction = 'up';
        this.segments = [
            { x: 14, y: 14 },
            { x: 14, y: 15 },
            { x: 14, y: 16 },
            { x: 14, y: 17 }
        ];
        this.score = 0;
        this.topScore = Math.max(this.topScore || 0, this.score);
        this.placeApple();
        this.flash = 0;
        this.updateScoreDisplays();
    }

    placeApple() {
        let x, y;
        do {
            x = Math.floor(Math.random() * this.GRID_SIZE);
            y = Math.floor(Math.random() * this.GRID_SIZE);
        } while (this.segments.some(seg => seg.x === x && seg.y === y));
        this.apple = { x, y };
    }

    move() {
        const head = this.segments[0];
        const newHead = { ...head };

        this.aiDecideDirection();

        switch (this.direction) {
            case 'up':    newHead.y--; break;
            case 'down':  newHead.y++; break;
            case 'left':  newHead.x--; break;
            case 'right': newHead.x++; break;
        }

        // Wall crash
        if (newHead.x < 0 || newHead.x >= this.GRID_SIZE ||
            newHead.y < 0 || newHead.y >= this.GRID_SIZE) {
            this.reset();
            return;
        }

        // Self crash
        if (this.segments.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
            this.reset();
            return;
        }

        this.segments.unshift(newHead);

        // Apple?
        if (newHead.x === this.apple.x && newHead.y === this.apple.y) {
            this.score++;
            if (this.score > this.topScore) this.topScore = this.score;
            if (this.score % 10 === 0 && this.score !== 0) this.flash = 12;
            this.placeApple();
        } else {
            this.segments.pop();
        }

        this.updateScoreDisplays();
    }

    stateReward(dir) {
        const head = this.segments[0];
        let tx = head.x, ty = head.y;

        switch (dir) {
            case 'forward':
                switch (this.direction) {
                    case 'up':    ty--; break;
                    case 'down':  ty++; break;
                    case 'left':  tx--; break;
                    case 'right': tx++; break;
                }
                break;
            case 'left':
                switch (this.direction) {
                    case 'up':    tx--; break;
                    case 'down':  tx++; break;
                    case 'left':  ty++; break;
                    case 'right': ty--; break;
                }
                break;
            case 'right':
                switch (this.direction) {
                    case 'up':    tx++; break;
                    case 'down':  tx--; break;
                    case 'left':  ty--; break;
                    case 'right': ty++; break;
                }
                break;
        }

        let reward = 0;
        if (tx < 0 || tx >= this.GRID_SIZE || ty < 0 || ty >= this.GRID_SIZE) reward -= 100;
        if (tx === this.apple.x && ty === this.apple.y) reward += 100;

        const distNow = Math.abs(head.x - this.apple.x) + Math.abs(head.y - this.apple.y);
        const distThen = Math.abs(tx - this.apple.x) + Math.abs(ty - this.apple.y);
        if (distThen < distNow) reward += 5;

        if (this.segments.slice(1).some(seg => seg.x === tx && seg.y === ty)) reward -= 100;

        return reward;
    }

    aiDecideDirection() {
        const fwd = this.stateReward('forward');
        const left = this.stateReward('left');
        const right = this.stateReward('right');

        if (fwd >= left && fwd >= right) return;

        if (left > right) this.turnLeft();
        else this.turnRight();
    }

    turnLeft() {
        const turns = { up: 'left', left: 'down', down: 'right', right: 'up' };
        this.direction = turns[this.direction];
    }

    turnRight() {
        const turns = { up: 'right', right: 'down', down: 'left', left: 'up' };
        this.direction = turns[this.direction];
    }

    updateScoreDisplays() {
        const scoreEl = document.getElementById('snake-score');
        const topEl = document.getElementById('snake-top-score');
        if (scoreEl) scoreEl.textContent = this.score;
        if (topEl) topEl.textContent = this.topScore;
    }

    draw() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid glow outline
        for (let i = 0; i < 200; i += 4) {
            this.ctx.strokeStyle = `rgba(85, 85, 255, ${0.8 - i / 300})`;
            const s = this.GRID_DIM + i * 2;
            this.ctx.strokeRect(this.offsetX - i, this.offsetY - i, s, s);
        }

        // Apple
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(
            this.offsetX + this.apple.x * this.CELL_SIZE,
            this.offsetY + this.apple.y * this.CELL_SIZE,
            this.CELL_SIZE, this.CELL_SIZE
        );

        // Snake
        this.segments.forEach((seg, i) => {
            const bright = 150 + 105 * Math.sin(i * 0.2);
            const flashing = this.flash > 0 && i < 12;

            // Outer glow
            this.ctx.fillStyle = flashing
                ? `rgb(${Math.random() * 200 + 55}, ${Math.random() * 255}, 255)`
                : `rgb(0, 0, ${Math.floor(bright)})`;
            this.ctx.fillRect(
                this.offsetX + seg.x * this.CELL_SIZE,
                this.offsetY + seg.y * this.CELL_SIZE,
                this.CELL_SIZE, this.CELL_SIZE
            );

            // Inner body
            this.ctx.fillStyle = flashing ? '#88ffff' : '#00ff00';
            this.ctx.fillRect(
                this.offsetX + seg.x * this.CELL_SIZE + 2,
                this.offsetY + seg.y * this.CELL_SIZE + 2,
                this.CELL_SIZE - 4, this.CELL_SIZE - 4
            );
        });

        if (this.flash > 0) this.flash--;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    pause() {
        this.running = false;
    }

    loop(time) {
        if (!this.running) return;

        const delta = time - (this.lastTime || time);
        if (delta > 70) {  // ~14 FPS – matches your original C version feel
            this.move();
            this.lastTime = time;
        }

        this.draw();
        requestAnimationFrame(this.loop);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const snakeScreen = document.getElementById('app-snake');

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';

    snakeScreen.innerHTML = '';  // clear placeholder
    snakeScreen.appendChild(canvas);

    const game = new AISnakeGame(canvas);
    window.snakeGame = game;  // for debugging / future extensions

    // Auto start/pause + resize when tab is shown
    const observer = new MutationObserver(() => {
        if (snakeScreen.classList.contains('active')) {
            game.resizeCanvas();
            game.updateScoreDisplays();
            if (!game.running) game.start();
        } else {
            game.pause();
        }
    });
    observer.observe(snakeScreen, { attributes: true, attributeFilter: ['class'] });

    // Buttons
    document.querySelectorAll('#bottom-snake .control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.textContent.includes('Start') || btn.textContent.includes('Restart')) {
                game.reset();
                game.start();
                btn.textContent = 'Restart';
            } else if (btn.textContent === 'Pause') {
                game.pause();
                btn.textContent = 'Resume';
            } else if (btn.textContent === 'Resume') {
                game.start();
                btn.textContent = 'Pause';
            }
        });
    });

    // Set initial button text
    document.querySelector('#bottom-snake .control-btn:nth-child(1)').textContent = 'Restart';
    document.querySelector('#bottom-snake .control-btn:nth-child(2)').textContent = 'Pause';
});
