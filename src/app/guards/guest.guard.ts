import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';

export const guestGuard: CanMatchFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  return isLoggedIn ? router.createUrlTree(['/tabs/home']) : true;
};
