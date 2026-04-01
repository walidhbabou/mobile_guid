import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { TokenService } from '../services/token.service';

export const guestGuard: CanMatchFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const tokenService = inject(TokenService);

  return tokenService.isAuthenticated() ? router.createUrlTree(['/tabs/home']) : true;
};
