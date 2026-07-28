import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorScreen from './ErrorScreen';

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * 렌더링 중 어디서든 예외가 나면 앱이 하얗게 죽어버리는데(원인도 안 보임),
 * 그걸 막고 에러 내용을 화면에 띄웁니다. 화면이 텅 비는 상황을 없애기 위한 최후 방어선.
 */
export default class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.error('[wishcat] render error', error, info?.componentStack);
    this.setState({ info: info?.componentStack ? String(info.componentStack).split('\n').slice(0, 8).join('\n') : null });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const detail = [error.stack ? String(error.stack).split('\n').slice(0, 6).join('\n') : null, info]
      .filter(Boolean)
      .join('\n\n');
    return (
      <SafeAreaProvider>
        <ErrorScreen
          title="앱이 잠깐 넘어졌어요"
          message={`${error.name}: ${error.message}`}
          detail={detail || null}
          primaryLabel="다시 시도"
          onPrimary={this.reset}
        />
      </SafeAreaProvider>
    );
  }
}
