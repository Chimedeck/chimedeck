import { useEffect } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { loginThunk, selectAuthStatus, selectAuthError } from '../../duck/authDuck';
import LoginForm from '../../components/LoginForm';
import translations from '../../translations/en.json';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const status = useAppSelector(selectAuthStatus);
  const apiError = useAppSelector(selectAuthError);

  // Redirect on successful login
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/workspaces', { replace: true });
    }
  }, [status, navigate]);

  const handleSubmit = async (email: string, password: string) => {
    await dispatch(loginThunk({ email, password }));
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
          <span className="text-xl font-bold text-white">HoriFlow</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">{translations.login.title}</h1>
        <p className="text-slate-400 text-sm mb-6">{translations.login.subtitle}</p>

        <LoginForm
          onSubmit={handleSubmit}
          isLoading={status === 'loading'}
          apiError={apiError}
        />

        <p className="text-slate-500 text-sm text-center mt-4">
          <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 font-medium">
            {translations.loginPage.forgotPassword}
          </Link>
        </p>

        <p className="text-slate-500 text-sm text-center mt-4">
          {translations.login.noAccount}{' '}
          <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
            {translations.login.signUp}
          </Link>
        </p>
      </div>
    </main>
  );
}
