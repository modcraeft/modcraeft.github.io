class GLCubeDemo {
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.imageRendering = 'crisp-edges';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.angleX = 0;
        this.angleY = 0;
        this.angleZ = 0;

        this.logo = new Image();
        this.logo.src = 'img/logo.png';
        this.logo.onload = () => this.resize();

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) * 0.9;
        this.canvas.width = size;
        this.canvas.height = size;
        this.size = size;
        this.centerX = size / 2;
        this.centerY = size / 2;
        this.scale = size * 0.35;
    }

	project(x, y, z) {
		const ax = this.angleX, ay = this.angleY, az = this.angleZ;

		// Rotate X
		let y1 = y * Math.cos(ax) - z * Math.sin(ax);
		let z1 = y * Math.sin(ax) + z * Math.cos(ax);
		y = y1; z = z1;

		// Rotate Y
		let x2 = x * Math.cos(ay) + z * Math.sin(ay);
		let z2 = -x * Math.sin(ay) + z * Math.cos(ay);
		x = x2; z = z2;

		// Rotate Z
		let x3 = x * Math.cos(az) - y * Math.sin(az);
		let y3 = x * Math.sin(az) + y * Math.cos(az);
		x = x3; y = y3;

		// Perspective
		const fov = 400;
		let depth = z + 800;
		if (depth < 0.1) depth = 0.1;
		const scale = fov / depth;

		return {
			x: this.centerX + x * scale,
			y: this.centerY + y * scale,
			scale: scale,
			depth: depth
		};
	}

    drawFace(points, brightness = 1) {
        if (points.length < 3) return;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.closePath();

        // Fill with logo texture
        this.ctx.save();
        this.ctx.clip();
        const avgX = points.reduce((a, p) => a + p.x, 0) / points.length;
        const avgY = points.reduce((a, p) => a + p.y, 0) / points.length;
        const size = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) * 1.2;
        this.ctx.globalAlpha = 0.9 * brightness;
        this.ctx.drawImage(this.logo, avgX - size/2, avgY - size/2, size, size);
        this.ctx.restore();

        // Glowing edge
        this.ctx.strokeStyle = `rgba(85, 153, 255, ${0.6 * brightness})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    loop() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.logo.complete) {
            requestAnimationFrame(this.loop);
            return;
        }

        const s = this.scale;

        // Cube vertices
        const vertices = [
            {x: -1, y: -1, z: -1},
            {x:  1, y: -1, z: -1},
            {x:  1, y:  1, z: -1},
            {x: -1, y:  1, z: -1},
            {x: -1, y: -1, z:  1},
            {x:  1, y: -1, z:  1},
            {x:  1, y:  1, z:  1},
            {x: -1, y:  1, z:  1}
        ].map(v => this.project(v.x * s, v.y * s, v.z * s));

        // Sort faces back to front
        const faces = [
            { pts: [0,1,2,3], normal: [0,0,-1] }, // front
            { pts: [5,4,7,6], normal: [0,0,1]  }, // back
            { pts: [1,5,6,2], normal: [1,0,0]  }, // right
            { pts: [0,3,7,4], normal: [-1,0,0] }, // left
            { pts: [3,2,6,7], normal: [0,1,0]  }, // top
            { pts: [0,1,5,4], normal: [0,-1,0] }  // bottom
        ];

        // Simple brightness based on face normal vs view
        faces.sort((a, b) => {
            const za = vertices[a.pts[0]].depth + vertices[a.pts[1]].depth;
            const zb = vertices[b.pts[0]].depth + vertices[b.pts[1]].depth;
            return zb - za;
        });

        faces.forEach(face => {
            const pts = face.pts.map(i => vertices[i]);
            const brightness = Math.max(0.4, Math.abs(face.normal[2]) * 0.7 + 0.4);
            this.drawFace(pts, brightness);
        });

        // Rotation
        this.angleX += 0.007;
        this.angleY += 0.011;
        this.angleZ += 0.005;

        requestAnimationFrame(this.loop);
    }
}

// Auto-init when cube tab is opened
document.addEventListener('DOMContentLoaded', () => {
    const screen = document.getElementById('app-glcube');
    if (!screen) return;

    let demo = null;

    const observer = new MutationObserver(() => {
        if (screen.classList.contains('active')) {
            if (!demo) {
                screen.innerHTML = '<h2>3D Cube</h2><p>OpenGL-style rotating cube with affine warped texture</p>';
                demo = new GLCubeDemo(screen);
                window.glcubeDemo = demo;
            }
        }
    });
    observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
});
