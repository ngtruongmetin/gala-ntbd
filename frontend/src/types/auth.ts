export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  roles: Array<'super_admin' | 'admin' | 'check_in'>;
}

export interface AuthState {
  authenticated: boolean;
  user: AuthenticatedUser | null;
  csrfToken: string;
  googleAuthAvailable: boolean;
}

export interface AuthResponse {
  data: AuthState;
}
