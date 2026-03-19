import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { clearAuth, selectAuthUser } from '~/extensions/Auth/duck/authDuck';

// Minimal topbar — expands in Sprint 17 with workspace switcher and full nav
export default function TopbarContainer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);

  const handleLogout = () => {
    dispatch(clearAuth());
    navigate('/login');
  };

  return (
    <div className="flex h-12 items-center justify-between border-b border-white/10 bg-gray-900 px-4">
      <span className="font-semibold text-white">HoriFlow</span>
      {user && (
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-white"
          aria-label="Log out"
        >
          Log out
        </button>
      )}
    </div>
  );
}
