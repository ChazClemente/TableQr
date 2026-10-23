import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../store/supabase.service';

type Step = 'role' | 'form';
type CardRole = 'Admin' | 'Cashier' | 'Kitchen';

interface RoleCard {
  role: CardRole;
  icon: string;
  title: string;
  sub: string;
  redirectTo: string;
  accent: string;
  accentText: string;
  accentBorder: string;
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: 'Admin',
    icon: '👑',
    title: 'Staff',
    sub: 'Full system access — menu, users, analytics, and all modules',
    redirectTo: '/admin/home',
    accent: '#7A3B1E',
    accentText: '#FFF8EE',
    accentBorder: '#5C2E0A',
  },
  {
    role: 'Cashier',
    icon: '🖥',
    title: 'Cashier',
    sub: 'POS terminal, bill settlement, discounts, receipts, and day closing',
    redirectTo: '/cashier/pos',
    accent: '#4A7C59',
    accentText: '#FFF8EE',
    accentBorder: '#3A6047',
  },
  {
    role: 'Kitchen',
    icon: '👨‍🍳',
    title: 'Kitchen Staff',
    sub: 'Kitchen display, order queue, and stock availability control',
    redirectTo: '/admin/kds',
    accent: '#8B6914',
    accentText: '#FFF8EE',
    accentBorder: '#6B4F0E',
  },
];

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
})
export class Login {
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  roleCards = ROLE_CARDS;
  step: Step = 'role';
  card: RoleCard | null = null;
  username = '';
  password = '';
  showPass = false;
  error = '';
  loading = false;

  // Para hindi na kailangang galawin ang template na may supabaseMode
  supabaseMode = true;

  handleRoleSelect(card: RoleCard) {
    this.card = card;
    this.username = '';
    this.password = '';
    this.error = '';
    this.step = 'form';
  }

  async handleLogin() {
  this.error = '';
  if (!this.username.trim() || !this.password) {
    this.error = 'Please enter your email and password.';
    return;
  }

  this.loading = true;
  try {
    console.log('1 signIn...');
    const user = await this.supabase.signIn(this.username.trim(), this.password);
    console.log('2 signed in', user?.id);

    const profile = await this.supabase.getCurrentStaffProfile();
    console.log('3 profile', profile);

    if (!user || !profile || !profile.active) {
      await this.supabase.client.auth.signOut();
      this.error = 'This account has no active staff profile. Ask an administrator for access.';
      return;
    }
    if (profile.role !== this.card!.role.toLowerCase()) {
      await this.supabase.client.auth.signOut();
      this.error = `This account is assigned the ${profile.role} role, not ${this.card!.role}.`;
      return;
    }

    console.log('4 audit...');
    try {
      await this.supabase.recordStaffAuthEvent('staff_signed_in');
    } catch (auditError) {
      await this.supabase.client.auth.signOut();
      throw new Error(
        `Sign-in could not be recorded in the audit log: ${auditError instanceof Error ? auditError.message : 'Unknown error'}`,
      );
    }

    console.log('5 navigating...');
    await this.router.navigate([this.card!.redirectTo]);
    console.log('6 done');
  } catch (error) {
    console.error('Login failed at:', error);
    this.error = error instanceof Error ? error.message : 'Sign-in failed.';
  } finally {
    this.loading = false;
  }
}

  get placeholder() {
    return 'staff@example.com';
  }
}