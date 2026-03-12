import { useEffect } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  confirmEmailChangeThunk,
  selectConfirmEmailChangeStatus,
  selectConfirmEmailChangeError,
} from './ConfirmEmailChangePage.duck';
import translations from '../../translations/en.json';

export default function ConfirmEmailChangePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const status = useAppSelector(selectConfirmEmailChangeStatus);
  const error = useAppSelector(selectConfirmEmailChangeError);

  useEffect(() => {
    if (token) {
      dispatch(confirmEmailChangeThunk({ token }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(
        () => navigate('/login', { replace: true, state: { toast: translations.changeEmail.confirmed } }),
        1500,
      );
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
          <span className="text-xl font-bold text-white">HoriFlow</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">
          {translations.changeEmail.title}
        </h1>

        {status === 'loading' && (
          <p className="text-slate-400">Confirming your email change…</p>
        )}

        {status === 'success' && (
          <p className="text-green-400 font-medium">{translations.changeEmail.confirmed}</p>
        )}

        {status === 'error' && (
          <div>
            <p className="text-red-400 mb-4">
              {error === 'email-already-in-use'
                ? translations.changeEmail.emailInUse
                : translations.changeEmail.invalidToken}
            </p>
            <Link
              to="/settings/profile"
              className="text-indigo-400 hover:text-indigo-300 text-sm underline"
            >
              Back to settings
            </Link>
          </div>
        )}

        {status === 'idle' && !token && (
          <p className="text-slate-400">{translations.changeEmail.invalidToken}</p>
        )}
      </div>
    </main>
  );
}
