import { Component, type ErrorInfo, type ReactNode } from 'react';
import translations from '~/common/translations/en.json';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-screen items-center justify-center text-red-400">
            {translations['Common.errorBoundaryFallback']}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
