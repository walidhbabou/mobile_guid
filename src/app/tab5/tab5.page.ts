import { Component } from '@angular/core';
import { UserProfileResponse } from '../models/auth.model';
import { ProfileAction, ProfileStat } from '../data/tourism.data';
import { AuthService } from '../services/auth.service';
import { CoreDataService } from '../services/core-data.service';
import { ThemeService } from '../services/theme.service';

interface ProfileForm {
  fullName: string;
  email: string;
  phone: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-tab5',
  templateUrl: 'tab5.page.html',
  styleUrls: ['tab5.page.scss'],
  standalone: false,
})
export class Tab5Page {
  userName = 'Utilisateur';
  userEmail = '';
  userInitial = 'U';
  profileStats: ProfileStat[] = [];
  profileActions: ProfileAction[] = [];
  profileBadges: string[] = [];

  profileForm: ProfileForm = this.buildEmptyProfileForm();
  passwordForm: PasswordForm = this.buildEmptyPasswordForm();

  isProfileLoading = false;
  isProfileSaving = false;
  isPasswordSaving = false;

  profileMessage = '';
  profileMessageType: 'success' | 'error' = 'success';
  passwordMessage = '';
  passwordMessageType: 'success' | 'error' = 'success';

  isEditingProfile = false;
  private profileFormSnapshot: ProfileForm = this.buildEmptyProfileForm();

  showCurrentPwd = false;
  showNewPwd = false;
  showConfirmPwd = false;

  readonly appVersion = '1.2.0';

  constructor(
    private authService: AuthService,
    private coreDataService: CoreDataService,
    private themeService: ThemeService
  ) {}

  get isDarkMode(): boolean {
    return this.themeService.isDark;
  }

  onToggleDarkMode(): void {
    this.themeService.toggle();
  }

  ionViewWillEnter() {
    this.loadLocalProfilePreview();
    this.loadProfileOverview();
    this.loadCurrentUserProfile();
  }

  get primaryAction(): ProfileAction | null {
    return this.profileActions[0] ?? null;
  }

  get secondaryActions(): ProfileAction[] {
    return this.profileActions.slice(1);
  }

  get profileCompletion(): number {
    let score = 0;
    if (this.profileForm.fullName.trim()) score += 40;
    if (this.profileForm.email.trim()) score += 40;
    if (this.profileForm.phone.trim()) score += 20;
    return score;
  }

  get passwordStrength(): number {
    const pwd = this.passwordForm.newPassword;
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 6) strength += 25;
    if (pwd.length >= 10) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9!@#$%^&*]/.test(pwd)) strength += 25;
    return strength;
  }

  get passwordStrengthLabel(): string {
    const s = this.passwordStrength;
    if (s <= 25) return 'Faible';
    if (s <= 50) return 'Moyen';
    if (s <= 75) return 'Bien';
    return 'Fort';
  }

  toggleProfileEdit() {
    if (this.isEditingProfile) {
      this.isEditingProfile = false;
    } else {
      this.profileFormSnapshot = { ...this.profileForm };
      this.isEditingProfile = true;
      this.profileMessage = '';
    }
  }

  cancelProfileEdit() {
    this.profileForm = { ...this.profileFormSnapshot };
    this.isEditingProfile = false;
    this.profileMessage = '';
  }

  logout() {
    this.authService.logout();
  }

  saveProfile() {
    const fullName = this.profileForm.fullName.trim();
    const email = this.profileForm.email.trim().toLowerCase();
    const phone = this.profileForm.phone.trim();

    if (!fullName || !email) {
      this.profileMessage = 'Le nom complet et l\'email sont obligatoires.';
      this.profileMessageType = 'error';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.profileMessage = 'Veuillez saisir un email valide.';
      this.profileMessageType = 'error';
      return;
    }

    this.isProfileSaving = true;
    this.profileMessage = '';

    this.authService.updateCurrentUserProfile({ fullName, email, phone }).subscribe({
      next: (profile: UserProfileResponse) => {
        this.isProfileSaving = false;
        this.isEditingProfile = false;
        this.applyProfile(profile);
        this.profileMessage = 'Vos informations ont été mises à jour avec succès.';
        this.profileMessageType = 'success';
        this.clearMessageAfter('profile');
      },
      error: (error: unknown) => {
        this.isProfileSaving = false;
        this.profileMessage = this.resolveErrorMessage(error, 'La mise à jour du profil a échoué.');
        this.profileMessageType = 'error';
      },
    });
  }

  updatePassword() {
    const currentPassword = this.passwordForm.currentPassword.trim();
    const newPassword = this.passwordForm.newPassword.trim();
    const confirmPassword = this.passwordForm.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      this.passwordMessage = 'Veuillez remplir les trois champs.';
      this.passwordMessageType = 'error';
      return;
    }

    if (newPassword.length < 6) {
      this.passwordMessage = 'Le nouveau mot de passe doit contenir au moins 6 caractères.';
      this.passwordMessageType = 'error';
      return;
    }

    if (newPassword !== confirmPassword) {
      this.passwordMessage = 'La confirmation ne correspond pas au nouveau mot de passe.';
      this.passwordMessageType = 'error';
      return;
    }

    this.isPasswordSaving = true;
    this.passwordMessage = '';

    this.authService.updateCurrentUserPassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.isPasswordSaving = false;
        this.passwordForm = this.buildEmptyPasswordForm();
        this.showCurrentPwd = false;
        this.showNewPwd = false;
        this.showConfirmPwd = false;
        this.passwordMessage = 'Votre mot de passe a été mis à jour.';
        this.passwordMessageType = 'success';
        this.clearMessageAfter('password');
      },
      error: (error: unknown) => {
        this.isPasswordSaving = false;
        this.passwordMessage = this.resolveErrorMessage(error, 'La mise à jour du mot de passe a échoué.');
        this.passwordMessageType = 'error';
      },
    });
  }

  private loadCurrentUserProfile() {
    this.isProfileLoading = true;
    this.authService.getCurrentUserProfile().subscribe({
      next: (profile: UserProfileResponse) => {
        this.isProfileLoading = false;
        this.applyProfile(profile);
      },
      error: () => {
        this.isProfileLoading = false;
      },
    });
  }

  private loadLocalProfilePreview() {
    const storedName = localStorage.getItem('userName') || 'Utilisateur';
    const storedEmail = localStorage.getItem('userEmail') || '';
    const storedPhone = localStorage.getItem('userPhone') || '';

    this.userName = storedName;
    this.userEmail = storedEmail;
    this.userInitial = storedName.charAt(0).toUpperCase() || 'U';
    this.profileForm = { fullName: storedName, email: storedEmail, phone: storedPhone };
  }

  private applyProfile(profile: UserProfileResponse) {
    const fullName = profile.fullName?.trim() || profile.username || 'Utilisateur';
    const email = profile.email?.trim() || this.userEmail;
    const phone = profile.phone?.trim() || '';

    this.userName = fullName;
    this.userEmail = email;
    this.userInitial = fullName.charAt(0).toUpperCase() || 'U';
    this.profileForm = { fullName, email, phone };
  }

  private loadProfileOverview() {
    this.coreDataService.getProfileOverview().subscribe((overview) => {
      this.profileStats = overview.stats;
      this.profileActions = overview.actions;
      this.profileBadges = overview.badges;
    });
  }

  private clearMessageAfter(target: 'profile' | 'password') {
    setTimeout(() => {
      if (target === 'profile') this.profileMessage = '';
      else this.passwordMessage = '';
    }, 4000);
  }

  private buildEmptyProfileForm(): ProfileForm {
    return { fullName: '', email: '', phone: '' };
  }

  private buildEmptyPasswordForm(): PasswordForm {
    return { currentPassword: '', newPassword: '', confirmPassword: '' };
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    const e = error as { error?: string; message?: string; email?: string; fullName?: string };
    return e?.error || e?.message || e?.email || e?.fullName || fallback;
  }
}
