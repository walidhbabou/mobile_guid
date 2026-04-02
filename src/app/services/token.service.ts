import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('token', accessToken);
    localStorage.setItem('isLoggedIn', 'true');
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  removeTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
  }

  isAuthenticated(): boolean {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();

    return (!!accessToken && !this.isTokenExpired(accessToken))
      || (!!refreshToken && !this.isTokenExpired(refreshToken));
  }

  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  isTokenExpired(token?: string): boolean {
    const t = token || this.getAccessToken();
    if (!t) return true;

    const decoded = this.decodeToken(t);
    if (!decoded) return true;

    const isExpired = decoded.exp ? decoded.exp * 1000 < Date.now() : false;
    return isExpired;
  }
}
