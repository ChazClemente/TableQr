import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService, type StaffProfile, type StaffRole } from '../../../store/supabase.service';
type Role = 'Admin' | 'Cashier' | 'Kitchen';

const ROLES: Role[] = ['Admin', 'Cashier', 'Kitchen'];
const ROLE_TO_STAFF_ROLE: Record<Role, StaffRole> = {
  Admin: 'admin',
  Cashier: 'cashier',
  Kitchen: 'kitchen',
};
const STAFF_ROLE_TO_ROLE: Record<StaffRole, Role> = {
  admin: 'Admin',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
};

const ROLE_META: Record<Role, { bg: string; text: string; border: string; icon: string; permissions: string[] }> = {
  Admin: {
    bg: '#7A3B1E18', text: '#7A3B1E', border: '#7A3B1E50', icon: '👑',
    permissions: ['Full system access', 'User management', 'Menu management', 'Analytics', 'Audit log', 'All cashier and kitchen functions'],
  },
  Cashier: {
    bg: '#4A7C5918', text: '#4A7C59', border: '#4A7C5950', icon: '🖥',
    permissions: ['POS terminal', 'Bill settlement', 'Discount manager (SC/PWD)', 'Receipts', 'End-of-day closing'],
  },
  Kitchen: {
    bg: '#D4A84318', text: '#8B6914', border: '#D4A84350', icon: '👨‍🍳',
    permissions: ['Kitchen display (KDS)', 'Stock control & availability toggle'],
  },
};

interface UserForm {
  name: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
}

type SortField = 'role' | 'createdAt' | 'status';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-user-management',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './user-management.html',
})
export class UserManagement implements OnInit {
  private supabase = inject(SupabaseService);

  roles = ROLES;
  roleMeta = ROLE_META;
  sortFields: SortField[] = ['role', 'createdAt', 'status'];

  users: StaffProfile[] = [];
  currentUserId: string | null = null;
  accessGranted = false;
  loading = true;
  saving = false;
  busyUserId: string | null = null;
  error = '';
  notice = '';
  showForm = false;
  editId: string | null = null;
  form: UserForm = this.blankForm();
  search = '';
  sortField: SortField | null = null;
  sortDir: SortDir = 'asc';

  async ngOnInit() {
    await this.loadUsers();
  }

  private blankForm(): UserForm {
    return { name: '', username: '', email: '', role: 'Cashier', active: true };
  }

  async loadUsers(clearNotice = true) {
    this.loading = true;
    this.error = '';
    this.accessGranted = false;
    if (clearNotice) this.notice = '';
    try {
      const profile = await this.supabase.getCurrentStaffProfile();
      if (!profile) {
        this.currentUserId = null;
        this.error = 'Sign in with a Supabase staff account to manage users.';
        return;
      }
      if (!profile.active || profile.role !== 'admin') {
        this.currentUserId = profile.id;
        this.error = 'This page is available to active administrators only.';
        return;
      }
      this.currentUserId = profile.id;
      this.users = await this.supabase.listStaffProfiles();
      this.accessGranted = true;
    } catch (error) {
      this.error = this.errorMessage(error, 'Unable to load staff profiles.');
    } finally {
      this.loading = false;
    }
  }

  get filteredUsers() {
    const q = this.search.trim().toLowerCase();
    return this.users.filter((user) => !q || [
      user.name, user.username, user.email, STAFF_ROLE_TO_ROLE[user.role], user.active ? 'active' : 'inactive',
    ].some((value) => value.toLowerCase().includes(q))).sort((a, b) => {
      if (!this.sortField) return 0;
      const direction = this.sortDir === 'asc' ? 1 : -1;
      if (this.sortField === 'role') {
        return STAFF_ROLE_TO_ROLE[a.role].localeCompare(STAFF_ROLE_TO_ROLE[b.role]) * direction;
      }
      if (this.sortField === 'createdAt') {
        return (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
      }
      return (Number(a.active) - Number(b.active)) * direction;
    });
  }

  sortLabel(field: SortField) {
    if (field === 'createdAt') return 'Joined';
    return field.charAt(0).toUpperCase() + field.slice(1);
  }

  handleSort(field: SortField) {
    if (this.sortField === field) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
  }

  openNew() {
    this.editId = null;
    this.form = this.blankForm();
    this.error = '';
    this.notice = '';
    this.showForm = true;
  }

  openEdit(user: StaffProfile) {
    this.editId = user.id;
    this.form = {
      name: user.name,
      username: user.username,
      email: user.email,
      role: STAFF_ROLE_TO_ROLE[user.role],
      active: user.active,
    };
    this.error = '';
    this.notice = '';
    this.showForm = true;
  }

  async handleSave() {
    const form = this.form;
    if (!form.name.trim() || !form.username.trim() || (!this.editId && !form.email.trim())) {
      this.error = 'Name, username, and email are required.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.notice = '';
    try {
      if (this.editId) {
        const existing = this.users.find((user) => user.id === this.editId);
        if (!existing) throw new Error('The staff profile no longer exists. Refresh the list and try again.');
        if (this.editId === this.currentUserId) {
          form.role = STAFF_ROLE_TO_ROLE[existing.role];
          form.active = existing.active;
        }
        await this.supabase.updateStaffProfile(this.editId, {
          name: form.name,
          username: form.username,
          role: ROLE_TO_STAFF_ROLE[form.role],
          active: form.active,
        });
        this.notice = 'Staff profile updated.';
      } else {
        const invited = await this.supabase.inviteStaffUser({
          email: form.email.trim(),
          displayName: form.name.trim(),
          username: form.username.trim(),
          role: ROLE_TO_STAFF_ROLE[form.role],
        });
        this.notice = `Invitation sent to ${invited.email}.`;
      }
      this.showForm = false;
      await this.loadUsers(false);
    } catch (error) {
      this.error = this.errorMessage(error, 'Unable to save staff changes.');
    } finally {
      this.saving = false;
    }
  }

  async toggleActive(user: StaffProfile) {
    if (user.id === this.currentUserId || this.busyUserId) return;
    this.busyUserId = user.id;
    this.error = '';
    this.notice = '';
    try {
      await this.supabase.updateStaffProfile(user.id, {
        name: user.name,
        username: user.username,
        role: user.role,
        active: !user.active,
      });
      this.notice = `${user.name} is now ${user.active ? 'inactive' : 'active'}.`;
      await this.loadUsers(false);
    } catch (error) {
      this.error = this.errorMessage(error, 'Unable to change account status.');
    } finally {
      this.busyUserId = null;
    }
  }

  isCurrentUser(user: StaffProfile) {
    return user.id === this.currentUserId;
  }

  displayRole(user: StaffProfile): Role {
    return STAFF_ROLE_TO_ROLE[user.role];
  }

  isEditingSelf() {
    return this.editId !== null && this.editId === this.currentUserId;
  }

  closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget && !this.saving) this.showForm = false;
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    return fallback;
  }
}