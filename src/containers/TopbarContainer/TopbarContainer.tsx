import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { clearAuth, selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import Button from '~/common/components/Button';
import translations from '~/common/translations/en.json';

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
    <div className="flex h-12 items-center justify-between border-b border-border bg-bg-surface px-4">
      <span className="font-semibold text-base">{translations['App.name']}</span>
      {user && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          aria-label="Log out"
        >
          Log out
        </Button>
      )}
    </div>
  );
}
