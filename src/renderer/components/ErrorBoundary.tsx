import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in React component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: 'red' }}>
          <h2>糟糕，界面渲染出错了</h2>
          <p>您可以尝试重启应用，如果问题持续存在，请导出诊断日志并联系开发者。</p>
          <details style={{ whiteSpace: 'pre-wrap', color: 'gray', textAlign: 'left', background: '#f0f0f0', padding: 12, borderRadius: 8 }}>
            <summary>错误详情</summary>
            {this.state.error?.stack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}