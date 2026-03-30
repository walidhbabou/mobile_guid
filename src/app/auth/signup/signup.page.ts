import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

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
    private toastController: ToastController
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
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const formValue = this.signupForm.getRawValue();
      localStorage.setItem('userEmail', formValue.email);
      localStorage.setItem('userName', `${formValue.firstName} ${formValue.lastName}`);
      localStorage.setItem('isLoggedIn', 'true');

      await this.showToast('Inscription reussie, votre guide est pret.', 'success');
      await this.router.navigate(['/tabs/home']);
    } catch (error) {
      await this.showToast('Erreur lors de l inscription.', 'danger');
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
    this.router.navigate(['/auth/login']);
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
