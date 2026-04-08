// "or continue with" divider used between the email form and OAuth buttons
export default function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 border-t border-slate-700" />
      <span className="text-muted text-sm">or</span>
      <div className="flex-1 border-t border-slate-700" />
    </div>
  );
}
