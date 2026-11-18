import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../store/supabase.service';
import { HOME_BY_ROLE } from '../../../guards/role.guard';

type State = 'checking' | 'ready' | 'invalid' | 'saving';

@Component({
  selector: 'app-set-password',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4" style="background: #F4ECD8">
      <div class="w-full max-w-sm rounded border p-6" style="background: #FFF8EE; border-color: #C4A882">
        <div class="flex flex-col items-center text-center mb-5">
          <img src="/logo-full.jpg" alt="Kainan kay Aling Nene"
            class="h-16 w-16 rounded-full object-cover mb-3" style="border: 1.5px solid #C4A882" />
          <h1 class="text-xl font-bold" style="font-family: 'Playfair Display', serif; color: #2C1810">
            Set your password
          </h1>
          <p class="text-xs mt-1" style="color: #9B7B5A">Kainan Kay Aling Nene — Staff Portal</p>
        </div>

        @switch (state()) {
          @case ('checking') {
            <p class="text-sm text-center" style="color: #9B7B5A">Verifying your invitation...</p>
          }
          @case ('invalid') {
            <p class="text-sm text-center" style="color: #C0392B">
              This invitation link is invalid or has expired. Please ask an administrator to send a new one.
            </p>
            <button (click)="goLogin()" class="w-full mt-4 py-2.5 text-sm rounded border"
              style="border-color: #C4A882; color: #7A3B1E; font-family: Lato">Go to login</button>
          }
          @default {
            <p class="text-xs mb-4 text-center" style="color: #6B4C35">
              Signed in as <strong>{{ email() }}</strong>. Choose a password to finish setting up your account.
            </p>
            <form (ngSubmit)="save()" class="space-y-3">
              <input type="password" name="pw" [(ngModel)]="password" autocomplete="new-password"
                placeholder="New password (min. 8 characters)"
                class="w-full text-sm px-3 py-2 rounded border outline-none"
                style="border-color: #C4A882; background: #FFF8EE; color: #2C1810; font-family: Lato" />
              <input type="password" name="pw2" [(ngModel)]="confirm" autocomplete="new-password"
                placeholder="Confirm password"
                class="w-full text-sm px-3 py-2 rounded border outline-none"
                style="border-color: #C4A882; background: #FFF8EE; color: #2C1810; font-family: Lato" />
              @if (error()) {
                <p class="text-xs" style="color: #C0392B">{{ error() }}</p>
              }
              <button type="submit" [disabled]="state() === 'saving'"
                class="w-full py-2.5 text-sm font-bold rounded hover:opacity-90 disabled:opacity-60"
                style="background: #7A3B1E; color: #FFF8EE; font-family: Lato">
                {{ state() === 'saving' ? 'Saving...' : 'Save password and continue' }}
              </button>
            </form>
          }
        }
      </div>
    </div>
  `,
})
export class SetPassword implements OnInit, OnDestroy {
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  state = signal<State>('checking');
  email = signal('');
  error = signal('');
  password = '';
  confirm = '';

  private unsubscribe?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  async ngOnInit() {
    const auth = this.supabase.client.auth;

    // The invite link carries a token in the URL; supabase-js turns it into a session.
    const { data } = await auth.getSession();
    if (data.session) return this.ready(data.session.user.email);

    // Session may still be getting established; wait briefly for it.
    const sub = auth.onAuthStateChange((_event, session) => {
      if (session) this.ready(session.user.email);
    });
    this.unsubscribe = () => sub.data.subscription.unsubscribe();
    this.timer = setTimeout(() => {
      if (this.state() === 'checking') this.state.set('invalid');
    }, 4000);
  }

  ngOnDestroy() {
    this.unsubscribe?.();
    if (this.timer) clearTimeout(this.timer);
  }

  private ready(email?: string | null) {
    if (this.timer) clearTimeout(this.timer);
    this.email.set(email ?? '');
    if (this.state() === 'checking') this.state.set('ready');
  }

  async save() {
    this.error.set('');
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.state.set('saving');
    const { error } = await this.supabase.client.auth.updateUser({ password: this.password });
    if (error) {
      this.error.set(error.message);
      this.state.set('ready');
      return;
    }

    const profile = await this.supabase.getCurrentStaffProfile();
    if (!profile || !profile.active) {
      await this.supabase.client.auth.signOut();
      this.error.set('Your password was saved, but this account has no active staff profile. Ask an administrator for access.');
      this.state.set('ready');
      return;
    }
    const dest = HOME_BY_ROLE[String(profile.role).toLowerCase() as keyof typeof HOME_BY_ROLE] ?? '/login';
    await this.router.navigate([dest]);
  }

  async goLogin() {
    await this.router.navigate(['/login']);
  }
}