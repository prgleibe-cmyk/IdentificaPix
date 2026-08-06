import { IAuthProvider, AuthProviderType, AuthSession, AuthUser } from './types';
import { LocalAuthProvider } from './providers/LocalAuthProvider';

class AuthAdapter implements IAuthProvider {
  readonly type: AuthProviderType = 'LOCAL';
  private provider: LocalAuthProvider = new LocalAuthProvider();

  public getProviderType(): AuthProviderType {
    return 'LOCAL';
  }

  public setProviderType(provider: AuthProviderType): void {
    // Local provider is now permanent
  }

  public getProvider(): IAuthProvider {
    return this.provider;
  }

  public async getToken(): Promise<string | null> {
    return this.provider.getToken();
  }

  public async getSession(): Promise<AuthSession | null> {
    return this.provider.getSession();
  }

  public async getUser(): Promise<AuthUser | null> {
    return this.provider.getUser();
  }

  public async logout(): Promise<void> {
    return this.provider.logout();
  }
}

export const authAdapter = new AuthAdapter();

// Helper exports matching standard usage:
export const getAuthToken = () => authAdapter.getToken();
export const getAuthSession = () => authAdapter.getSession();
export const getAuthUser = () => authAdapter.getUser();
export const authLogout = () => authAdapter.logout();
export const setAuthProviderType = (type: AuthProviderType) => authAdapter.setProviderType(type);
export const getAuthProviderType = () => authAdapter.getProviderType();

export * from './types';

