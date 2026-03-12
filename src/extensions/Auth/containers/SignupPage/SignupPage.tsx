import { useEffect } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { signupThunk, selectAuthStatus, selectAuthError, selectPendingEmail } from '../../duck/authDuck';
import SignupForm from '../../components/SignupForm';
import VerificationPending from '../../components/VerificationPending';
import translations from '../../translations/en.json';

export default function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const status = useAppSelector(selectAuthStatus);
  const apiError = useAppSelector(selectAuthError);
  const pendingEmail = useAppSelector(selectPendingEmail);

  // Auto-redirect after successful signup (signupThunk logs the user in)
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/workspaces', { replace: true });
    }
  }, [status, navigate]);

  const handleSubmit = async (name: string, email: string, password: string) => {
    await dispatch(signupThunk({ name, email, password }));
  };

  // Show verification pending screen after signup when email verification is required
  if (status === 'pending-verification' && pendingEmail) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-8">
            <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
            <span className="text-xl font-bold text-white">HoriFlow</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">{translations.verifyEmail.title}</h1>
          <VerificationPending email={pendingEmail} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
          <span className="text-xl font-bold text-white">HoriFlow</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">{translations.signup.title}</h1>
        <p className="text-slate-400 text-sm mb-6">{translations.signup.subtitle}</p>

        <SignupForm
          onSubmit={handleSubmit}
          isLoading={status === 'loading'}
          apiError={apiError}
        />

        <p className="text-slate-500 text-sm text-center mt-6">
          {translations.signup.haveAccount}{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            {translations.signup.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
