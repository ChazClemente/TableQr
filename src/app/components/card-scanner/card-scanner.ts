import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import Tesseract from 'tesseract.js';

type ScanState = 'idle' | 'scanning' | 'done' | 'invalid' | 'error';

export interface ScannedData {
  name: string;
  idNumber: string;
  extra: string;
  thumbnail: string;
  valid: boolean;
  reason?: string;
}

/**
 * Clean up the image before OCR: ~1600px, grayscale, shading correction
 * so typewriter text shows up even with glare and lines crossing the letters.
 */
async function preprocessForOcr(dataUrl: string): Promise<string | null> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image load failed'));
    i.src = dataUrl;
  });
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (!long) return null;

  const scale = 1600 / long;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
  }

  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + row;
    }
  }

  const R = 40;
  const norm = new Float32Array(n);
  const BINS = 2000;
  const MAXV = 1.5;
  const hist = new Uint32Array(BINS + 1);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R);
    const y1 = Math.min(h, y + R + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R);
      const x1 = Math.min(w, x + R + 1);
      const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
      const bg = Math.max(1, sum / ((x1 - x0) * (y1 - y0)));
      const v = gray[y * w + x] / bg;
      norm[y * w + x] = v;
      hist[Math.min(BINS, Math.max(0, Math.floor((v / MAXV) * BINS)))]++;
    }
  }

  const pct = (q: number) => {
    const target = q * n;
    let acc = 0;
    for (let b = 0; b <= BINS; b++) {
      acc += hist[b];
      if (acc >= target) return (b / BINS) * MAXV;
    }
    return MAXV;
  };
  const lo = pct(0.01);
  const hi = Math.max(pct(0.99), lo + 1e-3);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const v = Math.min(255, Math.max(0, ((norm[i] - lo) / (hi - lo)) * 255));
    px[p] = px[p + 1] = px[p + 2] = v;
    px[p + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[n];
}
@Component({
  selector: 'app-card-scanner',
  templateUrl: './card-scanner.html',
})
export class CardScanner {
  Math = Math;

  discountType = input.required<'senior' | 'pwd'>();
  confirmed = output<ScannedData>();
  typeMismatch = output<'senior' | 'pwd'>();

  scanState = signal<ScanState>('idle');
  progress = signal(0);
  scanned = signal<ScannedData | null>(null);
  imgSrc = signal<string | null>(null);
  dragOver = signal(false);

  // NEW: Signals for editing
  isEditing = signal(false);
  editName = signal('');
  editId = signal('');

  private timer: ReturnType<typeof setInterval> | null = null;
  private cancelled = false;
  private suppressNextReset = false;

  cardLabel = computed(() => (this.discountType() === 'senior' ? 'Senior Citizen' : 'PWD'));
  cardColor = computed(() => (this.discountType() === 'senior' ? '#4A7C59' : '#7A3B1E'));

  constructor() {
    effect(() => {
      this.discountType();
      untracked(() => {
        if (this.suppressNextReset) {
          this.suppressNextReset = false;
          return;
        }
        this.reset();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.cancelled = true;
      this.clearTimer();
    });
  }

  private clearTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.scanned.set({
        name: '', idNumber: '', extra: '', thumbnail: '',
        valid: false,
        reason: 'That file is not an image. Please upload a JPG or PNG.',
      });
      this.scanState.set('invalid');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => this.runScan(e.target!.result as string);
    reader.readAsDataURL(file);
  }

  onFileChange(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.handleFile(f);
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  private runScan(dataUrl: string) {
    this.cancelled = false;
    this.imgSrc.set(dataUrl);
    this.scanState.set('scanning');
    this.progress.set(0);

    let p = 0;
    this.timer = setInterval(() => {
      p += Math.random() * 18 + 4;
      if (p >= 100) {
        p = 100;
        this.clearTimer();
        this.finishScan(dataUrl);
      }
      this.progress.set(Math.min(p, 100));
    }, 90);
  }

  private async finishScan(dataUrl: string) {
    if (this.cancelled) return;
    try {
          const worker = await Tesseract.createWorker('eng', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.0/dist/worker.min.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0',
      });

      const { data } = await worker.recognize(dataUrl);

      const raw = (data.text || '').trim();
      console.log('[OCR RAW]\n' + raw);

      let detected = this.detectCardType(raw);
      let parseAs: 'senior' | 'pwd' = detected ?? this.discountType();
      let result = this.parseRaw(raw, dataUrl, parseAs);

      // If unreadable: clean up the image and retry with two other page modes
      if (!result.valid && !this.cancelled) {
        const texts = [raw];
        const pre = await preprocessForOcr(dataUrl).catch(() => null);
        if (pre) {
          for (const psm of [Tesseract.PSM.SINGLE_BLOCK, Tesseract.PSM.SPARSE_TEXT]) {
            if (this.cancelled) break;
            await worker.setParameters({ tessedit_pageseg_mode: psm });
            const r = await worker.recognize(pre);
            const t = (r.data.text || '').trim();
            console.log('[OCR RAW psm ' + psm + ']\n' + t);
            texts.push(t);
          }
          detected = detected ?? this.detectCardType(texts.join('\n'));
          parseAs = detected ?? this.discountType();
          const retry = this.parseMany(texts, dataUrl, parseAs);
          const score = (r: ScannedData) => (r.valid ? 2 : 0) + (r.name ? 1 : 0) + (r.idNumber ? 1 : 0);
          if (score(retry) > score(result)) result = retry;
        }
      }

      await worker.terminate();
      if (this.cancelled) return;

      if (detected && detected !== this.discountType()) {
        this.suppressNextReset = true;
        this.typeMismatch.emit(detected);
      }

      if (this.cancelled) return;
      this.scanned.set(result);
      this.scanState.set(result.valid ? 'done' : 'invalid');
    } catch (err) {
      console.error('OCR failed:', err);
      if (this.cancelled) return;
      this.scanned.set({
        name: '', idNumber: '', extra: '', thumbnail: dataUrl,
        valid: false,
        reason: 'Could not read the image. Try a clearer, well-lit photo.',
      });
      this.scanState.set('invalid');
    }
  }

  private detectCardType(raw: string): 'senior' | 'pwd' | null {
    const upper = raw.toUpperCase();
    const hasSenior = /\bSENIOR\b/.test(upper) || /OSCA/.test(upper) || /SENIOR\s+CITIZENS\s+AFFAIRS/.test(upper);
    const hasPwd = /\bPWD\b/.test(upper) || /PERSON\s+WITH\s+DISABILITY/.test(upper);
    if (hasSenior && !hasPwd) return 'senior';
    if (hasPwd && !hasSenior) return 'pwd';
    return null;
  }

  private parseRaw(raw: string, dataUrl: string, type: 'senior' | 'pwd'): ScannedData {
    const isSenior = type === 'senior';
    const lines = raw.split(/\r?\n/).map(l => l.replace(/[|»\]\[\\]/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.length > 1);

    const idNumber = this.extractIdNumber(lines, raw, isSenior);
    const name = this.extractName(lines, isSenior);

    let extra = '';
    if (isSenior) {
      const dob = raw.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
      extra = dob ? `Born ${dob[1]}` : '';
    } else {
      const dis = raw.match(/(ORTHOPEDIC|VISUAL|HEARING|PSYCHOSOCIAL|SPEECH|LEARNING|INTELLECTUAL|PHYSICAL|MENTAL|DEAF|BLIND)[A-Z \/]*/i);
      extra = dis ? this.titleCase(dis[0].trim()) : '';
    }

    if (!name && !idNumber) {
      return { name: '', idNumber: '', extra, thumbnail: dataUrl, valid: false, reason: 'No readable name or ID number found on the card.' };
    }
    if (!name) {
      return { name: '', idNumber, extra, thumbnail: dataUrl, valid: false, reason: 'Found an ID number but could not read the name.' };
    }
    if (!idNumber) {
      return { name, idNumber: '', extra, thumbnail: dataUrl, valid: false, reason: 'Found a name but could not read the ID number.' };
    }

    return { name, idNumber, extra, thumbnail: dataUrl, valid: true };
  }

  private extractIdNumber(lines: string[], raw: string, isSenior: boolean): string {
    const anchors = isSenior ? [/OSCA\s*(?:ID\s*)?NO/i, /CTR[L1]\.?\s*NO/i, /CONTROL\s*NO/i, /ID\s*NO/i] : [/PWD\s*ID/i, /ID\s*NUMBER/i, /ID\s*NO/i];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const anchor of anchors) {
        if (anchor.test(line)) {
          const same = line.match(/(\d[\d\-\/]{2,20})/);
          if (same && !this.looksLikeDate(same[1])) return same[1].trim();
          if (lines[i + 1]) {
            const next = lines[i + 1].match(/(\d[\d\-\/]{2,20})/);
            if (next && !this.looksLikeDate(next[1])) return next[1].trim();
          }
          if (i > 0 && lines[i - 1]) {
            const prev = lines[i - 1].match(/(\d[\d\-\/]{2,20})/);
            if (prev && !this.looksLikeDate(prev[1])) return prev[1].trim();
          }
        }
      }
    }

    const dashedMatches = raw.match(/\b\d{1,4}(?:-\d{1,7}){1,5}\b/g) || [];
    for (const candidate of dashedMatches) {
      if (!this.looksLikeDate(candidate)) return candidate;
    }

    const loose = raw.match(/\b\d{4,}\b/g) || [];
    for (const candidate of loose) {
      if (!this.looksLikeDate(candidate)) return candidate;
    }
    return '';
  }

  private looksLikeDate(s: string): boolean {
    const parts = s.split(/[-\/.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(p => parseInt(p, 10));
      if (isNaN(a) || isNaN(b) || isNaN(c)) return false;
      if (c >= 1900 && c <= 2100 && a >= 1 && a <= 12 && b >= 1 && b <= 31) return true;
      if (c >= 1900 && c <= 2100 && b >= 1 && b <= 12 && a >= 1 && a <= 31) return true;
    }
    if (/^\d{4}$/.test(s)) {
      const y = parseInt(s, 10);
      if (y >= 1900 && y <= 2100) return true;
    }
    return false;
  }

  private extractName(lines: string[], isSenior: boolean): string {
    const isNameish = (s: string): boolean => {
      const trimmed = s.trim();
      if (trimmed.length < 4 || trimmed.length > 60) return false;
      if (!/^[A-Z]/.test(trimmed)) return false;

      if (/(REPUBLIC|PHILIPPINES|MUNICIPALITY|BARANGAY|PROVINCE|CITY|OFFICE|SENIOR\s+CITIZENS|AFFAIRS|PWD\s+ID|DISABILITY|SIGNATURE|THUMBPRINT|THUMBMARK|VALID|ANYWHERE|COUNTRY|THIS\s+CARD|ADDRESS|BIRTH|SEX|DATE|ISSUED|CONTROL|NON-?TRANSFERABLE|BENEFITS|RIGHTS|PRIVILEGES|ACCORDANCE|REPUBLIC\s+ACTS|VIOLATION|PUNISHABLE|PRINTED|HOLDER|ENTITLED|PERSON\s+WITH|VALID\s+FOR|THREE|YEARS|LAW|BULACAN|BALIWAG|BATANGAS|LAGUNA|RIZAL|CAVITE|SURALLAH|MARIKINA|ROXAS|MINDORO|POBLACION|ST\.|STREET|AVE|ROAD|BRGY|CENTRALA|CENTRO|PUROK)/i.test(trimmed)) return false;

      const words = trimmed.split(/\s+/).filter(w => w.length > 0);
      if (words.length < 2 || words.length > 6) return false;

      const nameWordRe = /^(?:[A-Z]{2,}|[A-Z][a-z'\-]+\.?|[A-Z]\.?|Jr\.?|Sr\.?|II+|IV|VI?)$/;
      if (!words.every(w => nameWordRe.test(w))) return false;

      return true;
    };

    for (const line of lines) {
      const m = line.match(/Name\s*[:\-]?\s*([A-Z][A-Za-z.,'\- ]{3,60})/i);
      if (m) {
        let candidate = m[1].replace(/\s*[|—–\-]{1,}\s*.*$/, '').trim();
        candidate = candidate.replace(/\s+[|»\]\\]+\s*$/, '').trim();
        if (isNameish(candidate)) return this.cleanName(candidate);
      }
    }

    for (let i = 1; i < lines.length; i++) {
      if (/Name\s+of\s+PWD/i.test(lines[i]) || /^\s*NAME\s*$/i.test(lines[i])) {
        const prev = lines[i - 1];
        if (isNameish(prev)) return this.cleanName(prev);
      }
    }

    const candidates = lines.filter(isNameish);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.length - a.length);
      return this.cleanName(candidates[0]);
    }

    return '';
  }
    /** Combines several OCR passes: votes on the ID number and picks the cleanest name. */
  private parseMany(texts: string[], dataUrl: string, type: 'senior' | 'pwd'): ScannedData {
    const isSenior = type === 'senior';
    const toLines = (t: string) =>
      t.split(/\r?\n/).map(l => l.replace(/[|»\]\[\\]/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.length > 1);

    const ids: string[] = [];
    const names: string[] = [];
    for (const t of texts) {
      const lines = toLines(t);
      const id = this.extractIdNumber(lines, t, isSenior);
      if (id) ids.push(id);
      const strict = this.extractName(lines, isSenior);
      if (strict) names.push(strict);
      names.push(...this.extractNameLoose(lines));
    }

    const idNumber = this.mostFrequent(ids);
    const notLabel = (n: string) =>
      !/(THUMB|MARK|SIGNATURE|PRINTED|NON-?TRANSFERABLE|ISSUED|ADDRESS|AFFAIRS|CITIZENS|BIRTH|\bID\b|\bNO\b|\bSEX\b|\bAGE\b|\bDATE\b)/i.test(n);
    const name = this.pickName(names.filter(notLabel));

    const all = texts.join('\n');
    let extra = '';
    if (isSenior) {
      const dob = all.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
      extra = dob ? `Born ${dob[1]}` : '';
    } else {
      const dis = all.match(/(ORTHOPEDIC|VISUAL|HEARING|PSYCHOSOCIAL|SPEECH|LEARNING|INTELLECTUAL|PHYSICAL|MENTAL|DEAF|BLIND)[A-Z \/]*/i);
      extra = dis ? this.titleCase(dis[0].trim()) : '';
    }

    if (!name && !idNumber) {
      return { name: '', idNumber: '', extra, thumbnail: dataUrl, valid: false, reason: 'No readable name or ID number found on the card.' };
    }
    if (!name) {
      return { name: '', idNumber, extra, thumbnail: dataUrl, valid: false, reason: 'Found an ID number but could not read the name.' };
    }
    if (!idNumber) {
      return { name, idNumber: '', extra, thumbnail: dataUrl, valid: false, reason: 'Found a name but could not read the ID number.' };
    }
    return { name, idNumber, extra, thumbnail: dataUrl, valid: true };
  }

  private mostFrequent(items: string[]): string {
    if (!items.length) return '';
    const count = new Map<string, number>();
    items.forEach(i => count.set(i, (count.get(i) ?? 0) + 1));
    let best = '';
    let bestN = 0;
    for (const i of items) {
      const n = count.get(i)!;
      if (n >= bestN) {
        best = i;
        bestN = n;
      }
    }
    return best;
  }

  private extractNameLoose(lines: string[]): string[] {
    const out: string[] = [];
    const skip = /(PRINTED|SIGNATURE|THUMB|ADDRESS|BIRTH|DATE|REPUBLIC|PHILIPPINES|OFFICE|SENIOR|CITIZENS|AFFAIRS|CITY|BULACAN|MEYCAUAYAN|CAMALIG|NON-?TRANSFERABLE|THIS\s+CARD|ID\s*NO)/i;
    for (const line of lines) {
      const m = line.match(/\bNam[eoa]r?\b[\s:;.\-]*(.+)$/i);
      if (m && !skip.test(line)) {
        const c = this.tidyName(m[1]);
        if (c) out.push(c);
      } else if (/^[A-Z][A-Z.,' -]{6,}$/.test(line) && !skip.test(line) && !/\b(NAME|MARK)\b/.test(line)) {
        const c = this.tidyName(line);
        if (c) out.push(c);
      }
    }
    return out;
  }

  private tidyName(raw: string): string {
    const cleaned = raw.replace(/[^A-Za-z.'\- ]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens: string[] = [];
    for (const raw0 of cleaned.split(' ')) {
      const t = raw0.replace(/^[.'\-]+/, '').replace(/['\-]+$/, '');
      if (!t || !/[A-Za-z]/.test(t)) continue;
      if (/^[a-z]$/.test(t)) {
        if (tokens.length === 1) {
          tokens[0] += t;
          continue;
        }
        break;
      }
      tokens.push(t);
      if (tokens.length >= 4) break;
    }
    const fixed = tokens
      .map(t => t.replace(/\./g, '. ').trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = fixed.split(' ');
    const letters = fixed.replace(/[^A-Za-z]/g, '').length;
    if (words.length < 2 || words.length > 5 || letters < 6) return '';
    return fixed;
  }

  private pickName(cands: string[]): string {
    if (!cands.length) return '';
    const toks = (c: string) => c.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(t => t.length >= 3);
    const sets = cands.map(toks);
    let best = '';
    let bestScore = -1;
    cands.forEach((c, i) => {
      let agree = 0;
      for (const t of sets[i]) {
        sets.forEach((o, j) => {
          if (j !== i && o.some(x => x === t || (Math.abs(x.length - t.length) <= 1 && levenshtein(x, t) <= 1))) agree++;
        });
      }
      const words = c.split(' ');
      const wellFormed = words.filter(w => /^(?:[A-Z]{2,}|[A-Z][a-z'\-]+\.?|[A-Z]\.?)$/.test(w)).length / words.length;
      const score = agree * 2 + wellFormed * 5 + Math.min(sets[i].length, 3);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    });
    return this.cleanName(best).replace(/\.(?=[A-Za-z])/g, '. ');
  }

  // For "Type or correct the details" when OCR cannot read the card
  manualEntry() {
    const s = this.scanned();
    const name = s?.name ?? '';
    const id = s?.idNumber ?? '';
    this.scanned.set({
      name,
      idNumber: id,
      extra: s?.extra ?? '',
      thumbnail: s?.thumbnail ?? this.imgSrc() ?? '',
      valid: true,
    });
    this.editName.set(name);
    this.editId.set(id);
    this.isEditing.set(true);
    this.scanState.set('done');
  }
  private cleanName(raw: string): string {
    const cleaned = raw.replace(/[.,;:]+$/, '').replace(/\s+/g, ' ').trim();
    const fixed = cleaned.replace(/\b([A-Z])o\./g, '$1.');
    return this.titleCase(fixed);
  }

  private titleCase(s: string): string {
    return s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/\b(Mc|Mac)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
  }

  // NEW: Functions to handle editing
  startEdit() {
    const s = this.scanned();
    if (!s) return;
    this.editName.set(s.name);
    this.editId.set(s.idNumber);
    this.isEditing.set(true);
  }

  saveEdit() {
    const s = this.scanned();
    if (!s) return;
    
    const newName = this.editName().trim();
    const newId = this.editId().trim();

    if (!newName || !newId) {
      alert('Name and ID cannot be empty.');
      return;
    }

    this.scanned.set({
      ...s,
      name: newName,
      idNumber: newId
    });
    this.isEditing.set(false);
  }

  cancelEdit() {
    this.isEditing.set(false);
  }

  reset() {
    this.cancelled = true;
    this.clearTimer();
    this.scanState.set('idle');
    this.scanned.set(null);
    this.imgSrc.set(null);
    this.progress.set(0);
    this.dragOver.set(false);
    this.isEditing.set(false);
  }

  confirm() {
    const s = this.scanned();
    if (s && s.valid) this.confirmed.emit(s);
  }
}