// EditProfilePage — stub page for editing user profile info.
// Sprint 28: Navigated to when clicking "Edit profile info" in the member popover.
// Full profile editing is deferred; this is a placeholder UI.
import { useNavigate } from 'react-router-dom';

const EditProfilePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">Edit Profile</h1>
        <p className="text-slate-400 mb-6">
          Profile editing is coming soon. Your name, nickname, and avatar can be
          updated here once this feature is fully implemented.
        </p>
        <button
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition-colors"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

export default EditProfilePage;
