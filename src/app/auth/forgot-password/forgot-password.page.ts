import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: false
})
export class ForgotPasswordPage implements OnDestroy {
  step: 1 | 2 | 3 = 1;
  isLoading = false;

  emailForm: FormGroup;
  resetForm: FormGroup;

  resendCooldown = 0;
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private authService: AuthService
  ) {
    this.emailForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.formBuilder.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnDestroy(): void {
    this.clearCooldown();
  }

  async sendCode() {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    try {
      await firstValueFrom(
        this.authService.forgotPassword({ email: this.emailForm.value.email.trim() })
      );
      this.step = 2;
      this.startCooldown(60);
    } catch (error) {
      await this.showToast(this.extractMessage(error), 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async resendCode() {
    if (this.resendCooldown > 0 || this.isLoading) return;

    this.isLoading = true;
    try {
      await firstValueFrom(
        this.authService.forgotPassword({ email: this.emailForm.value.email.trim() })
      );
      await this.showToast('Un nouveau code a ete envoye.', 'success');
      this.startCooldown(60);
    } catch (error) {
      await this.showToast(this.extractMessage(error), 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async resetPassword() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    try {
      await firstValueFrom(
        this.authService.resetPassword({
          email: this.emailForm.value.email.trim(),
          code: this.resetForm.value.code.trim(),
          newPassword: this.resetForm.value.newPassword,
        })
      );
      this.clearCooldown();
      this.step = 3;
    } catch (error) {
      await this.showToast(this.extractMessage(error), 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  goToLogin() {
    void this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  private startCooldown(seconds: number) {
    this.clearCooldown();
    this.resendCooldown = seconds;
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        this.clearCooldown();
      }
    }, 1000);
  }

  private clearCooldown() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.resendCooldown = 0;
  }

  private extractMessage(error: unknown): string {
    const e = error as { error?: string; message?: string };
    return e?.error || e?.message || 'Une erreur est survenue. Veuillez reessayer.';
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 4000,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
