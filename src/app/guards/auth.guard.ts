import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';

export const authGuard: CanMatchFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  return isLoggedIn ? true : router.createUrlTree(['/auth/login']);
};
