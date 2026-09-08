/* Adapted from the supplied folio-book.zip. See REFERENCE.md and README.md. */
(() => {
  const DEFAULT_PAGES = [
    {
      eyebrow: 'FOLIO  /  VOLUME 01',
      title: '余白を、\nめくる。',
      body: '手の動きに、紙がついてくる。\nゆっくりと流れる時間を、一冊に。',
      color: '#eae6dc',
      ink: '#243c3a',
      kind: 'title',
    },
    {
      eyebrow: '01  /  A MOMENT OF STILLNESS',
      title: '静けさの\n輪郭',
      body: '窓から差し込む光が、\n何も書かれていない紙に落ちる。\n\nまだ名前のない考えも、\nここではひとつの風景になる。',
      color: '#f7f4eb',
      ink: '#263d3b',
    },
    {
      eyebrow: '02  /  BETWEEN THE LINES',
      title: '行間に\n触れる',
      body: '読み進めること。\n少しだけ、立ち止まること。\n\n指先で持ち上げた一枚の向こうに、\n次の時間が待っている。',
      color: '#f4f0e6',
      ink: '#263d3b',
    },
    {
      eyebrow: 'FOLIO  /  NOTES',
      title: 'ゆっくり、\n次の頁へ。',
      body: '急がなくていい。\n戻ってもいい。\n\n本は、あなたの速さで進んでいく。',
      color: '#29433e',
      ink: '#ede7d6',
      kind: 'title',
    },
    {
      eyebrow: '03  /  SMALL DISCOVERIES',
      title: '小さな\n発見',
      body: '見慣れた言葉が、\n今日は違う意味を持つ。\n\nページをめくるたび、\n世界はほんの少しだけ変わる。',
      color: '#f4f0e6',
      ink: '#263d3b',
    },
    {
      eyebrow: '04  /  ROOM TO IMAGINE',
      title: '想像の\n余地',
      body: '書ききらなかったこと。\n描かなかった線。\n\nその余白に、\nあなたの物語を重ねて。',
      color: '#f7f4eb',
      ink: '#263d3b',
    },
    {
      eyebrow: '05  /  KEEP THIS MOMENT',
      title: 'この瞬間を\nとどめる',
      body: '心に残った一節を、\nそっと折りたたむように。\n\nまた開く日のために、\n今日の気持ちを置いていく。',
      color: '#f4f0e6',
      ink: '#263d3b',
    },
    {
      eyebrow: 'FOLIO  /  UNTIL NEXT TIME',
      title: 'また、\nここで。',
      body: '最後のページは、\n次のはじまり。',
      color: '#eae6dc',
      ink: '#243c3a',
      kind: 'title',
    },
  ];
  class FolioBook extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._pages = DEFAULT_PAGES;
      this.spread = -1;
      this.turn = null;
      this.raf = 0;
      this.generation = 0;
      this.shadowRoot.innerHTML = `<style>
        :host{display:block;width:100%;height:100%;min-height:340px;--folio-ink:#677eaa;color:var(--folio-ink);font-family:system-ui,sans-serif}
        *{box-sizing:border-box}.reader{height:100%;display:flex;flex-direction:column;align-items:center;position:relative}
        canvas{display:block;width:100%;flex:1;min-height:0;touch-action:none;cursor:grab;outline:none}canvas:active{cursor:grabbing}canvas:focus-visible{outline:1px solid #bacbbe;outline-offset:-8px;border-radius:12px}
        .toolbar{display:flex;align-items:center;gap:27px;padding:12px 0 14px;flex:none}button{border:1px solid #dde5f2;border-radius:50%;width:44px;height:44px;background:#fff;color:inherit;cursor:pointer;font-size:22px;transition:background .2s}button:hover:not(:disabled){background:#edf3fc}button:focus-visible{outline:2px solid #c8dbcc;outline-offset:4px}button:disabled{opacity:.2;cursor:default}.count{font-size:13px;letter-spacing:.16em;font-variant-numeric:tabular-nums;min-width:110px;text-align:center}.hint{margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#899ab6}.sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
        @media(max-width:520px){.toolbar{gap:20px}.hint{font-size:12px;letter-spacing:0}}
      </style><div class="reader"><canvas tabindex="0" role="group" aria-label="本。ドラッグ、または左右の矢印キーでページをめくる。"></canvas><div class="toolbar"><button class="prev" aria-label="前の見開き">‹</button><span class="count" aria-live="polite"></span><button class="next" aria-label="次の見開き">›</button></div><p class="hint">ページをドラッグしてめくる · ← →</p><div class="sr" aria-live="polite"></div></div>`;
      this.canvas = this.shadowRoot.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.prev = this.shadowRoot.querySelector('.prev');
      this.next = this.shadowRoot.querySelector('.next');
      this.prev.onclick = () => this.previousPage();
      this.next.onclick = () => this.nextPage();
      this.canvas.onkeydown = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          e.key === 'ArrowRight' ? this.nextPage() : this.previousPage();
        }
      };
      this.canvas.onpointerdown = (e) => this.down(e);
      this.canvas.onpointermove = (e) => this.move(e);
      this.canvas.onpointerup = (e) => this.up(e);
      this.canvas.onpointercancel = () => this.cancel();
      this.canvas.onlostpointercapture = () => {
        if (this.turn?.drag) this.cancel();
      };
    }
    connectedCallback() {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
      if (!this.textures) this.makeTextures();
      this.update();
    }
    disconnectedCallback() {
      this.resizeObserver?.disconnect();
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.dragRaf);
      this.turn = null;
      this.textures = null;
      this.generation++;
    }
    get pages() {
      return this._pages.map((p) => ({ ...p }));
    }
    set pages(value) {
      if (!Array.isArray(value) || value.length < 2)
        throw new TypeError('pages needs at least 2 page objects');
      this._pages = value.map((p) => ({ ...p }));
      if (this._pages.length % 2)
        this._pages.push({ color: '#f4f0e6', title: '', body: '' });
      cancelAnimationFrame(this.raf);
      this.turn = null;
      this.spread = -1;
      this.makeTextures();
      this.update();
      this.render();
    }
    // Atomic content replacement: cover is never an extra left-hand page.
    setContent({ cover, pages, bookType = 'book', title = 'Folio' }) {
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.dragRaf);
      this.turn = null;
      this.spread = -1;
      this.generation++;
      this.bookType = bookType;
      this.coverTitle = title;
      this.pageCount = pages.length;
      this._pages = pages.map((p) => ({
        title: p.title || '',
        body: p.body || '',
      }));
      this.textures = pages.map((p) => p.texture);
      while (this.textures.length < 2 || this.textures.length % 2) {
        const blank = document.createElement('canvas');
        blank.width = 700;
        blank.height = 980;
        const ctx = blank.getContext('2d');
        ctx.fillStyle = '#fafbfc';
        ctx.fillRect(0, 0, 700, 980);
        this.textures.push(blank);
        this._pages.push({ title: '', body: '' });
      }
      this.textures[-1] = cover;
      if (bookType === 'binder') {
        for (let i = -1; i < this.textures.length; i++)
          this.textures[i] = this.bindingTexture(
            this.textures[i],
            i >= 0 && i % 2 === 0,
          );
      }
      this.update();
      this.resize();
    }
    bindingTexture(image, leftPage) {
      const c = document.createElement('canvas');
      c.width = 700;
      c.height = 980;
      const x = c.getContext('2d'),
        margin = 40;
      x.fillStyle = '#f4f5f5';
      x.fillRect(0, 0, 700, 980);
      x.drawImage(image, leftPage ? 0 : margin, 0, 700 - margin, 980);
      const holeX = leftPage ? 682 : 18;
      for (let i = 0; i < 4; i++) {
        const y = (0.18 + (i * 0.64) / 3) * 980;
        const shade = x.createRadialGradient(holeX - 1, y - 1, 1, holeX, y, 7);
        shade.addColorStop(0, '#65717d');
        shade.addColorStop(0.7, '#424c58');
        shade.addColorStop(1, '#c5cbd1');
        x.fillStyle = shade;
        x.beginPath();
        x.arc(holeX, y, 7, 0, Math.PI * 2);
        x.fill();
      }
      return c;
    }
    rings() {
      if (this.bookType !== 'binder') return;
      const c = this.ctx,
        t = this.turn;
      for (let i = 0; i < 4; i++) {
        const y = -0.7 + 1.4 * (0.18 + (i * 0.64) / 3);
        // The moving attachment follows the punched edge, not a detached icon.
        const theta = t ? t.p * Math.PI : 0,
          dir = t?.dir || 1;
        const moving = this.project(
          dir * 0.026 * Math.cos(theta),
          y,
          0.014 + 0.026 * Math.sin(theta),
        );
        const right = this.project(0.026, y, 0.014),
          left = this.project(-0.026, y, 0.014);
        const start =
          this.spread === -1 && !t ? this.project(-0.028, y, 0.0) : left;
        const end = t ? moving : right;
        const top = this.project(0, y - 0.025, 0.07);
        c.save();
        c.lineCap = 'round';
        const metal = c.createLinearGradient(0, top.y - 2, 0, end.y + 3);
        metal.addColorStop(0, '#c8d1da');
        metal.addColorStop(0.3, '#fff');
        metal.addColorStop(0.55, '#7c8794');
        metal.addColorStop(1, '#c1cad4');
        c.beginPath();
        c.moveTo(start.x, start.y);
        c.bezierCurveTo(start.x - 4, top.y, end.x + 3, top.y, end.x, end.y);
        c.strokeStyle = '#576370';
        c.lineWidth = Math.max(2.5, this.unit * 0.014);
        c.stroke();
        c.strokeStyle = metal;
        c.lineWidth = Math.max(1.5, this.unit * 0.009);
        c.stroke();
        c.restore();
      }
    }
    get currentSpread() {
      return this.spread;
    }
    nextPage() {
      return this.begin(1);
    }
    previousPage() {
      return this.begin(-1);
    }
    begin(dir) {
      if (this.turn || !this.allowed(dir)) return false;
      this.turn = { dir, p: 0, drag: false };
      this.update();
      this.settle(1);
      return true;
    }
    allowed(dir) {
      return dir > 0
        ? this.spread < this._pages.length / 2 - 1
        : this.spread > -1;
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = r.width;
      this.h = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.unit = Math.min((this.w - 34) / 2.3, (this.h - 45) / 1.7);
      this.cx = this.w / 2;
      this.cy = this.h * 0.53;
      this.render();
    }
    makeTextures() {
      const generation = ++this.generation;
      this.textures = this._pages.map((p, i) => {
        const c = document.createElement('canvas');
        c.width = 700;
        c.height = 980;
        const x = c.getContext('2d');
        x.fillStyle = p.color || '#f4f0e6';
        x.fillRect(0, 0, 700, 980);
        x.fillStyle = p.ink || '#263d3b';
        x.font = '14px system-ui, sans-serif';
        x.fillText(p.eyebrow || '', 65, 76);
        x.globalAlpha = 0.22;
        x.fillRect(65, 100, 570, 1);
        x.globalAlpha = 1;
        x.font = `${p.kind === 'title' ? 76 : 66}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
        String(p.title || '')
          .split('\n')
          .forEach((s, j) => x.fillText(s, 65, 245 + j * 103, 570));
        x.font = '23px "Hiragino Mincho ProN", "Yu Mincho", serif';
        String(p.body || '')
          .split('\n')
          .forEach((s, j) => x.fillText(s, 68, 535 + j * 43, 564));
        x.globalAlpha = 0.5;
        x.font = '14px system-ui, sans-serif';
        x.fillText('F O L I O', 65, 916);
        x.textAlign = 'right';
        x.fillText(String(i + 1).padStart(2, '0'), 635, 916);
        x.globalAlpha = 1;
        if (p.image) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (generation !== this.generation) return;
            x.clearRect(0, 0, 700, 980);
            x.fillStyle = p.color || '#f4f0e6';
            x.fillRect(0, 0, 700, 980);
            const s = Math.min(700 / img.width, 980 / img.height);
            x.drawImage(
              img,
              (700 - img.width * s) / 2,
              (980 - img.height * s) / 2,
              img.width * s,
              img.height * s,
            );
            this.render();
          };
          img.onerror = () =>
            this.dispatchEvent(
              new CustomEvent('pageerror', {
                detail: { index: i, src: p.image },
              }),
            );
          img.src = p.image;
        }
        return c;
      });
      this.makeCover();
    }
    makeCover() {
      const page = this._pages[0],
        c = document.createElement('canvas');
      c.width = 700;
      c.height = 980;
      const x = c.getContext('2d');
      x.fillStyle = '#24453c';
      x.fillRect(0, 0, 700, 980);
      // Binding, inset border and restrained foil typography.
      const binding = x.createLinearGradient(0, 0, 42, 0);
      binding.addColorStop(0, '#0e2821');
      binding.addColorStop(0.55, '#35574b');
      binding.addColorStop(1, '#24453c');
      x.fillStyle = binding;
      x.fillRect(0, 0, 42, 980);
      x.strokeStyle = '#b8ad785c';
      x.lineWidth = 1.5;
      x.strokeRect(59, 55, 586, 866);
      x.fillStyle = '#d6c894';
      x.textAlign = 'center';
      x.font = 'italic 52px Georgia, serif';
      x.fillText('Folio', 350, 169);
      x.font = '16px system-ui, sans-serif';
      x.fillText('THE QUIET EDITION', 350, 223);
      x.font = '76px "Hiragino Mincho ProN", "Yu Mincho", serif';
      String(page.title || 'Folio')
        .split('\n')
        .forEach((line, i) => x.fillText(line, 350, 437 + i * 108, 535));
      x.globalAlpha = 0.7;
      x.font = '15px system-ui, sans-serif';
      x.fillText('V O L U M E   0 1', 350, 848);
      x.globalAlpha = 1;
      this.textures[-1] = c;
    }
    project(x, y, z = 0) {
      const depth = 1 - z * 0.18 + y * 0.045;
      return {
        x: this.cx + (x * this.unit) / depth,
        y: this.cy + ((y * 0.91 - z * 0.34) * this.unit) / depth,
      };
    }
    polygon(points, fill) {
      const c = this.ctx;
      c.beginPath();
      points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    }
    tri(img, src, dst) {
      const c = this.ctx;
      const [a, b, d] = src,
        [A, B, D] = dst;
      const det = (b.x - a.x) * (d.y - a.y) - (d.x - a.x) * (b.y - a.y);
      if (Math.abs(det) < 1e-6) return;
      const m1 = ((B.x - A.x) * (d.y - a.y) - (D.x - A.x) * (b.y - a.y)) / det;
      const m2 = ((B.y - A.y) * (d.y - a.y) - (D.y - A.y) * (b.y - a.y)) / det;
      const m3 = ((D.x - A.x) * (b.x - a.x) - (B.x - A.x) * (d.x - a.x)) / det;
      const m4 = ((D.y - A.y) * (b.x - a.x) - (B.y - A.y) * (d.x - a.x)) / det;
      c.save();
      c.beginPath();
      const mx = (A.x + B.x + D.x) / 3,
        my = (A.y + B.y + D.y) / 3;
      [A, B, D].forEach((p, i) => {
        const dx = p.x - mx,
          dy = p.y - my,
          l = Math.hypot(dx, dy) || 1;
        const xx = p.x + (dx / l) * 0.45,
          yy = p.y + (dy / l) * 0.45;
        i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
      });
      c.closePath();
      c.clip();
      c.transform(
        m1,
        m2,
        m3,
        m4,
        A.x - m1 * a.x - m3 * a.y,
        A.y - m2 * a.x - m4 * a.y,
      );
      c.drawImage(img, 0, 0);
      c.restore();
    }
    paper(index, dir = 1, p = 0, moving = false) {
      const segments = 56,
        coords = [{ x: 0, z: 0.014 }],
        bend =
          Math.sin(p * Math.PI) *
          (index === -1 || (index === 0 && dir === -1) ? 0.09 : 0.58);
      for (let j = 0; j < segments; j++) {
        const u = (j + 0.5) / segments,
          theta = p * Math.PI + bend * Math.cos(u * Math.PI) * 0.75;
        coords.push({
          x: coords[j].x + (dir * Math.cos(theta)) / segments,
          z: coords[j].z + Math.sin(theta) / segments,
        });
      }
      for (let j = 0; j < segments; j++) {
        const a = coords[j],
          b = coords[j + 1],
          back = (b.x - a.x) * dir < 0;
        const idx = moving ? (back ? index + dir : index) : index,
          img = this.textures[idx];
        if (!img) continue;
        let u0 = j / segments,
          u1 = (j + 1) / segments;
        if (dir < 0 !== back) {
          u0 = 1 - u0;
          u1 = 1 - u1;
        }
        const corners = [
          this.project(a.x, -0.7, a.z),
          this.project(b.x, -0.7, b.z),
          this.project(b.x, 0.7, b.z),
          this.project(a.x, 0.7, a.z),
        ];
        const src = [
          { x: u0 * 700, y: 0 },
          { x: u1 * 700, y: 0 },
          { x: u1 * 700, y: 980 },
          { x: u0 * 700, y: 980 },
        ];
        this.tri(
          img,
          [src[0], src[1], src[2]],
          [corners[0], corners[1], corners[2]],
        );
        this.tri(
          img,
          [src[0], src[2], src[3]],
          [corners[0], corners[2], corners[3]],
        );
        const shade =
          0.025 +
          0.14 * Math.exp(-j / 6) +
          (moving
            ? 0.19 *
              Math.sin(p * Math.PI) *
              Math.abs(Math.sin((j / segments) * Math.PI))
            : 0);
        this.polygon(corners, `rgba(20,28,22,${shade})`);
      }
    }
    render() {
      if (!this.w || !this.textures?.length) return;
      const t = this.turn,
        closed = this.spread === -1;
      const coverTurn = !!t && (closed || (this.spread === 0 && t.dir === -1));
      const closedAmount = coverTurn
        ? closed
          ? 1 - t.p
          : t.p
        : closed
          ? 1
          : 0;
      // Fit the closed cover more generously, continuously zooming out as it opens.
      const spreadUnit = Math.min((this.w - 34) / 2.3, (this.h - 45) / 1.7);
      this.unit = Math.min(
        spreadUnit * (1 + 0.55 * closedAmount),
        (this.h - 45) / 1.7,
      );
      this.cx = this.w / 2 - this.unit * 0.5 * closedAmount;
      const c = this.ctx;
      c.clearRect(0, 0, this.w, this.h);
      c.save();
      c.translate(this.w / 2, this.cy + this.unit * 0.64);
      c.scale(1 - closedAmount * 0.46, 0.16);
      const shadow = c.createRadialGradient(
        0,
        0,
        this.unit * 0.2,
        0,
        0,
        this.unit * 1.27,
      );
      shadow.addColorStop(0, '#00000080');
      shadow.addColorStop(1, '#00000000');
      c.fillStyle = shadow;
      c.fillRect(
        -this.unit * 1.3,
        -this.unit * 1.3,
        this.unit * 2.6,
        this.unit * 2.6,
      );
      c.restore();
      const baseLeft = closed || coverTurn ? 0 : -1;
      this.polygon(
        [
          this.project(baseLeft - 0.035, -0.725, -0.044),
          this.project(1.035, -0.725, -0.044),
          this.project(1.035, 0.745, -0.044),
          this.project(baseLeft - 0.035, 0.745, -0.044),
        ],
        '#d8dfe9',
      );
      for (let k = 8; k >= 0; k--) {
        let z = -0.005 - k * 0.004;
        this.polygon(
          [
            this.project(baseLeft, -0.7, z),
            this.project(1, -0.7, z),
            this.project(1, 0.7, z),
            this.project(baseLeft, 0.7, z),
          ],
          k % 2 ? '#cbd4e1' : '#f5f7fa',
        );
      }
      if (closed && !t) {
        this.paper(-1, 1);
        this.rings();
        return;
      }
      if (coverTurn) {
        this.paper(1, 1);
        const opacity = Math.sin(t.p * Math.PI) * 0.17;
        this.polygon(
          [
            this.project(0, -0.7),
            this.project(1, -0.7),
            this.project(1, 0.7),
            this.project(0, 0.7),
          ],
          `rgba(9,20,16,${opacity})`,
        );
        this.paper(closed ? -1 : 0, t.dir, t.p, true);
        this.rings();
        return;
      }
      const left = this.spread * 2,
        right = left + 1;
      this.paper(t?.dir === -1 ? left - 2 : left, -1);
      this.paper(t?.dir === 1 ? right + 2 : right, 1);
      if (t) {
        const opacity = Math.sin(t.p * Math.PI) * 0.17;
        this.polygon(
          [
            this.project(-1, -0.7),
            this.project(1, -0.7),
            this.project(1, 0.7),
            this.project(-1, 0.7),
          ],
          `rgba(9,20,16,${opacity})`,
        );
        this.paper(t.dir === 1 ? right : left, t.dir, t.p, true);
      }
      this.rings();
    }
    down(e) {
      if (this.turn || !e.isPrimary || e.button !== 0) return;
      const r = this.canvas.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
      if (
        Math.abs(x - this.cx) > this.unit * 1.1 ||
        Math.abs(y - this.cy) > this.unit * 0.77
      )
        return;
      if (this.spread === -1 && x < this.cx) return;
      const dir = x >= this.cx ? 1 : -1;
      if (!this.allowed(dir)) return;
      this.canvas.focus({ preventScroll: true });
      this.canvas.setPointerCapture(e.pointerId);
      this.turn = {
        dir,
        p: 0,
        drag: true,
        startX: e.clientX,
        dragWidth: this.unit * 1.75,
        lastX: e.clientX,
        lastTime: e.timeStamp,
        velocity: 0,
        distance: 0,
        id: e.pointerId,
      };
      this.update();
    }
    move(e) {
      const t = this.turn;
      if (!t?.drag || t.id !== e.pointerId) return;
      const dt = e.timeStamp - t.lastTime;
      if (dt > 0) t.velocity = ((t.lastX - e.clientX) * t.dir) / dt;
      t.lastX = e.clientX;
      t.lastTime = e.timeStamp;
      t.distance = Math.max(t.distance, Math.abs(e.clientX - t.startX));
      t.p = Math.max(
        0,
        Math.min(1, ((t.startX - e.clientX) * t.dir) / t.dragWidth),
      );
      if (!this.dragRaf)
        this.dragRaf = requestAnimationFrame(() => {
          this.dragRaf = 0;
          this.render();
        });
    }
    up(e) {
      const t = this.turn;
      if (!t?.drag || t.id !== e.pointerId) return;
      t.drag = false;
      const flick =
        e.timeStamp - t.lastTime < 100 && t.velocity > 0.45 && t.p > 0.08;
      const target = t.distance < 7 ? 1 : t.p > 0.42 || flick ? 1 : 0;
      if (this.canvas.hasPointerCapture(e.pointerId))
        this.canvas.releasePointerCapture(e.pointerId);
      this.settle(target);
    }
    cancel() {
      if (!this.turn?.drag) return;
      this.turn.drag = false;
      this.settle(0);
    }
    settle(target) {
      cancelAnimationFrame(this.dragRaf);
      this.dragRaf = 0;
      const t = this.turn,
        from = t.p,
        start = performance.now();
      const duration = matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : Math.max(200, 850 * Math.abs(target - from));
      const frame = (now) => {
        if (this.turn !== t) return;
        const v = duration ? Math.min(1, (now - start) / duration) : 1;
        const ease = v * v * v * (v * (v * 6 - 15) + 10);
        t.p = from + (target - from) * ease;
        this.render();
        if (v < 1) this.raf = requestAnimationFrame(frame);
        else {
          if (target === 1) this.spread += t.dir;
          this.turn = null;
          this.update();
          this.render();
          if (target === 1)
            this.dispatchEvent(
              new CustomEvent('pagechange', {
                detail: {
                  spread: this.spread,
                  pages:
                    this.spread === -1
                      ? []
                      : [this.spread * 2 + 1, this.spread * 2 + 2],
                  cover: this.spread === -1,
                },
                bubbles: true,
                composed: true,
              }),
            );
        }
      };
      this.raf = requestAnimationFrame(frame);
    }
    update() {
      this.prev.disabled = !!this.turn || !this.allowed(-1);
      this.next.disabled = !!this.turn || !this.allowed(1);
      this.shadowRoot.querySelector('.count').textContent =
        this.spread === -1
          ? '表紙'
          : `${String(this.spread * 2 + 1).padStart(2, '0')} — ${String(Math.min(this.spread * 2 + 2, this.pageCount ?? this._pages.length)).padStart(2, '0')} / ${String(this.pageCount ?? this._pages.length).padStart(2, '0')}`;
      this.shadowRoot.querySelector('.hint').textContent =
        this.spread === -1
          ? '表紙をドラッグして開く · →'
          : 'ページをドラッグしてめくる · ← →';
      this.shadowRoot.querySelector('.sr').textContent =
        this.spread === -1
          ? '表紙。' + (this.coverTitle || this._pages[0].title || 'Folio')
          : this._pages
              .slice(this.spread * 2, this.spread * 2 + 2)
              .map((p) => [p.title, p.body].filter(Boolean).join('\n'))
              .join('\n\n');
    }
  }
  if (!customElements.get('folio-book'))
    customElements.define('folio-book', FolioBook);
})();

export {};
