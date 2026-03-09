// Mounts all auth routes under /api/v1/auth.
import { handleLogin } from './login';
import { handleRegister } from './register';
import { handleRefresh } from './refresh';
import { handleLogout } from './logout';
import { handleOAuthRedirect } from './oauth/index';
import { handleOAuthCallback } from './oauth/callback';
import { handleVerifyEmail } from './verifyEmail';
import { handleResendVerification } from './resendVerification';
import { handleChangeEmail } from './changeEmail';
import { handleConfirmEmailChange } from './confirmEmailChange';
import { handleForgotPassword } from './forgotPassword';
import { handleResetPassword } from './resetPassword';
import type { OAuthProvider } from '../common/config/oauth';

const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'github'];

// Returns a Response if the path matches an auth route, otherwise null.
export async function authRouter(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === '/api/v1/auth/token' && req.method === 'POST') {
    return handleLogin(req);
  }

  if (pathname === '/api/v1/auth/register' && req.method === 'POST') {
    return handleRegister(req);
  }

  if (pathname === '/api/v1/auth/refresh' && req.method === 'POST') {
    return handleRefresh(req);
  }

  if (pathname === '/api/v1/auth/session' && req.method === 'DELETE') {
    return handleLogout(req);
  }

  if (pathname === '/api/v1/auth/verify-email' && req.method === 'GET') {
    return handleVerifyEmail(req);
  }

  if (pathname === '/api/v1/auth/resend-verification' && req.method === 'POST') {
    return handleResendVerification(req);
  }

  if (pathname === '/api/v1/auth/change-email' && req.method === 'POST') {
    return handleChangeEmail(req);
  }

  if (pathname === '/api/v1/auth/confirm-email-change' && req.method === 'GET') {
    return handleConfirmEmailChange(req);
  }

  if (pathname === '/api/v1/auth/forgot-password' && req.method === 'POST') {
    return handleForgotPassword(req);
  }

  if (pathname === '/api/v1/auth/reset-password' && req.method === 'POST') {
    return handleResetPassword(req);
  }

  // OAuth redirect: GET /api/v1/auth/oauth/:provider
  for (const provider of OAUTH_PROVIDERS) {
    if (pathname === `/api/v1/auth/oauth/${provider}` && req.method === 'GET') {
      return handleOAuthRedirect(req, provider);
    }
    if (pathname === `/api/v1/auth/oauth/${provider}/callback` && req.method === 'GET') {
      return handleOAuthCallback(req, provider);
    }
  }

  return null;
}
