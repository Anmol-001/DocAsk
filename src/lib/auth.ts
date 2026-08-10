/**
 * Securely manages the frontend authentication state.
 * Uses sessionStorage to persist the JWT across tab reloads but keeps it isolated.
 * The token is NEVER logged.
 */

export class AuthService {
  private static readonly TOKEN_KEY = 'docask_auth_token';
  private static readonly USER_ID_KEY = 'docask_auth_user_id';
  
  private static inMemoryToken: string | null = null;
  private static inMemoryUserId: string | null = null;

  static setToken(token: string, userId: string): void {
    this.inMemoryToken = token;
    this.inMemoryUserId = userId;
    
    // Store in sessionStorage so it persists across reloads in the same tab.
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.TOKEN_KEY, token);
      sessionStorage.setItem(this.USER_ID_KEY, userId);
    }
  }

  static getToken(): string | null {
    if (this.inMemoryToken) {
      return this.inMemoryToken;
    }
    
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(this.TOKEN_KEY);
    }
    
    return null;
  }

  static getUserId(): string | null {
    if (this.inMemoryUserId) {
      return this.inMemoryUserId;
    }
    
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(this.USER_ID_KEY);
    }
    
    return null;
  }

  static clearToken(): void {
    this.inMemoryToken = null;
    this.inMemoryUserId = null;
    
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.USER_ID_KEY);
    }
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
