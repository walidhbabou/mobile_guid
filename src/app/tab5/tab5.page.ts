import { Component } from '@angular/core';
import { UserProfileResponse } from '../models/auth.model';
import { ProfileAction, ProfileStat } from '../data/tourism.data';
import { AuthService } from '../services/auth.service';
import { CoreDataService } from '../services/core-data.service';

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
  userName = 'Sophie Dubois';
  userEmail = 'sophie@guide.ma';
  userInitial = 'S';
  profileStats: ProfileStat[] = [];
  profileActions: ProfileAction[] = [];
  profileBadges: string[] = [];
  profileForm: ProfileForm = this.buildEmptyProfileForm();
  passwordForm: PasswordForm = this.buildEmptyPasswordForm();
  isProfileLoading = false;
  isProfileSaving = false;
  isPasswordSaving = false;
  profileMessage = '';
  passwordMessage = '';

  constructor(
    private authService: AuthService,
    private coreDataService: CoreDataService
  ) {}

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

  logout() {
    this.authService.logout();
  }

  saveProfile() {
    const fullName = this.profileForm.fullName.trim();
    const email = this.profileForm.email.trim().toLowerCase();
    const phone = this.profileForm.phone.trim();

    if (!fullName || !email) {
      this.profileMessage = 'Le nom complet et l email sont obligatoires.';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.profileMessage = 'Veuillez saisir un email valide.';
      return;
    }

    this.isProfileSaving = true;
    this.profileMessage = '';

    this.authService.updateCurrentUserProfile({
      fullName,
      email,
      phone,
    }).subscribe({
      next: (profile: UserProfileResponse) => {
        this.isProfileSaving = false;
        this.applyProfile(profile);
        this.profileMessage = 'Vos informations personnelles ont ete mises a jour.';
      },
      error: (error: unknown) => {
        this.isProfileSaving = false;
        this.profileMessage = this.resolveErrorMessage(error, 'La mise a jour du profil a echoue.');
      },
    });
  }

  updatePassword() {
    const currentPassword = this.passwordForm.currentPassword.trim();
    const newPassword = this.passwordForm.newPassword.trim();
    const confirmPassword = this.passwordForm.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      this.passwordMessage = 'Remplissez les trois champs du mot de passe.';
      return;
    }

    if (newPassword.length < 6) {
      this.passwordMessage = 'Le nouveau mot de passe doit contenir au moins 6 caracteres.';
      return;
    }

    if (newPassword !== confirmPassword) {
      this.passwordMessage = 'La confirmation du mot de passe ne correspond pas.';
      return;
    }

    this.isPasswordSaving = true;
    this.passwordMessage = '';

    this.authService.updateCurrentUserPassword({
      currentPassword,
      newPassword,
    }).subscribe({
      next: () => {
        this.isPasswordSaving = false;
        this.passwordForm = this.buildEmptyPasswordForm();
        this.passwordMessage = 'Votre mot de passe a ete mis a jour.';
      },
      error: (error: unknown) => {
        this.isPasswordSaving = false;
        this.passwordMessage = this.resolveErrorMessage(error, 'La mise a jour du mot de passe a echoue.');
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
    const storedName = localStorage.getItem('userName') || 'Sophie Dubois';
    const storedEmail = localStorage.getItem('userEmail') || 'sophie@guide.ma';
    const storedPhone = localStorage.getItem('userPhone') || '';

    this.userName = storedName;
    this.userEmail = storedEmail;
    this.userInitial = this.userName.charAt(0).toUpperCase() || 'S';
    this.profileForm = {
      fullName: storedName,
      email: storedEmail,
      phone: storedPhone,
    };
  }

  private applyProfile(profile: UserProfileResponse) {
    const fullName = profile.fullName?.trim() || profile.username || 'Utilisateur';
    const email = profile.email?.trim() || this.userEmail;
    const phone = profile.phone?.trim() || '';

    this.userName = fullName;
    this.userEmail = email;
    this.userInitial = this.userName.charAt(0).toUpperCase() || 'U';
    this.profileForm = {
      fullName,
      email,
      phone,
    };
  }

  private loadProfileOverview() {
    this.coreDataService.getProfileOverview().subscribe((overview) => {
      this.profileStats = overview.stats;
      this.profileActions = overview.actions;
      this.profileBadges = overview.badges;
    });
  }

  private buildEmptyProfileForm(): ProfileForm {
    return {
      fullName: '',
      email: '',
      phone: '',
    };
  }

  private buildEmptyPasswordForm(): PasswordForm {
    return {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as { error?: string; message?: string; email?: string; fullName?: string };

    return apiError?.error || apiError?.message || apiError?.email || apiError?.fullName || fallback;
  }
}
