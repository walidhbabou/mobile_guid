import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: false
})
export class SignupPage implements OnInit {
  signupForm!: FormGroup;
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  initializeForm() {
    this.signupForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      agreeToTerms: [false, [Validators.requiredTrue]],
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  async signup() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      await this.showToast('Veuillez completer le formulaire.', 'danger');
      return;
    }

    this.isLoading = true;
    try {
      const formValue = this.signupForm.getRawValue();
      const email = (formValue.email || '').trim().toLowerCase();
      const fullName = this.buildFullName(formValue.firstName, formValue.lastName);

      await firstValueFrom(
        this.authService.signup({
          username: email,
          email,
          password: formValue.password,
          fullName,
        })
      );

      const response = await firstValueFrom(
        this.authService.login({
          username: email,
          password: formValue.password,
        })
      );

      this.authService.storeUserProfile(
        response.email || email,
        response.fullName || fullName
      );

      await this.showToast('Inscription reussie, votre guide est pret.', 'success');
      await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    } catch (error) {
      await this.showToast(
        this.resolveErrorMessage(error, 'Erreur lors de l inscription.'),
        'danger'
      );
    } finally {
      this.isLoading = false;
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin() {
    void this.router.navigateByUrl('/auth/login');
  }

  private buildFullName(firstName: string, lastName: string): string {
    return `${firstName || ''} ${lastName || ''}`.trim() || 'Nouvel utilisateur';
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
