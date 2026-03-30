import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

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
    email: 'sophie@guide.ma',
    password: '123456',
  };

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.fillDemoAccount();
  }

  initializeForm() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
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
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const formValue = this.loginForm.getRawValue();
      localStorage.setItem('userEmail', formValue.email);
      localStorage.setItem('userName', this.buildDisplayName(formValue.email));
      localStorage.setItem('isLoggedIn', 'true');

      await this.showToast('Connexion reussie, bon voyage !', 'success');
      await this.router.navigate(['/tabs/home']);
    } catch (error) {
      await this.showToast('Erreur de connexion.', 'danger');
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
    this.router.navigate(['/auth/signup']);
  }

  fillDemoAccount() {
    this.loginForm.patchValue({
      email: this.demoCredentials.email,
      password: this.demoCredentials.password,
      rememberMe: true,
    });
  }

  private buildDisplayName(email: string): string {
    const namePart = email.split('@')[0] || 'Sophie';

    return namePart
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Sophie';
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
