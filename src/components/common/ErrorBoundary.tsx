import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  resetText?: string;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleAction = () => {
    if (this.props.onReset) {
      this.setState({ hasError: false, error: null });
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white select-none font-sans"
        >
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-white">
              {this.props.fallbackTitle || 'حدث خطأ أثناء تحميل الصفحة'}
            </h2>
            <p className="text-sm text-slate-300">
              تم رصد خطأ غير متوقع في واجهة المستخدم، يمكنك المتابعة بالضغط على الزر أدناه.
            </p>
            {this.state.error && (
              <div className="bg-slate-950/60 rounded-lg p-3 text-xs text-rose-300 font-mono text-left overflow-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleAction}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-medium transition-all shadow-lg cursor-pointer"
            >
              {this.props.resetText || '🔄 إعادة تحميل التطبيق'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
