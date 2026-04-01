import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  showPassword = false;
  readonly demoCredentials = {
    identifier: 'admin',
    password: '2002',
  };

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.fillDemoAccount();
  }

  initializeForm() {
    this.loginForm = this.formBuilder.group({
      identifier: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      rememberMe: [true],
    });
  }

  async login() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      await this.showToast('Veuillez verifier vos identifiants.', 'danger');
      return;
    }

    this.isLoading = true;
    try {
      const formValue = this.loginForm.getRawValue();
      const identifier = (formValue.identifier || '').trim();
      const response = await firstValueFrom(
        this.authService.login({
          username: identifier,
          password: formValue.password,
        })
      );

      this.authService.storeUserProfile(
        response.email || identifier,
        response.fullName || this.buildDisplayName(response.username || identifier)
      );

      await this.showToast('Connexion reussie, bon voyage !', 'success');
      await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    } catch (error) {
      await this.showToast(
        this.resolveErrorMessage(error, 'Identifiant ou mot de passe invalide.'),
        'danger'
      );
    } finally {
      this.isLoading = false;
    }
  }

  loginWithGoogle() {
    this.fillDemoAccount();
    this.showToast('Compte demo Google prepare.', 'primary');
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  goToForgotPassword() {
    this.showToast('Recuperation du mot de passe bientot disponible.', 'medium');
  }

  goToSignup() {
    void this.router.navigateByUrl('/auth/signup');
  }

  fillDemoAccount() {
    this.loginForm.patchValue({
      identifier: this.demoCredentials.identifier,
      password: this.demoCredentials.password,
      rememberMe: true,
    });
  }

  private buildDisplayName(identifier: string): string {
    const namePart = identifier.includes('@')
      ? identifier.split('@')[0] || 'Sophie'
      : identifier || 'Sophie';

    return namePart
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Sophie';
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as { error?: string; message?: string };

    return apiError?.error || apiError?.message || fallback;
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
