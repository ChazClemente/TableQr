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
      await worker.terminate();

      const raw = (data.text || '').trim();
      console.log('[OCR RAW]\n' + raw);

      if (this.cancelled) return;

      const detected = this.detectCardType(raw);

      if (detected && detected !== this.discountType()) {
        this.suppressNextReset = true;
        this.typeMismatch.emit(detected);
      }

      const parseAs: 'senior' | 'pwd' = detected ?? this.discountType();
      const result = this.parseRaw(raw, dataUrl, parseAs);

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