/**
 * Error Boundary component to catch React errors
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error);
        console.error('Error info:', errorInfo);
        console.error('Error stack:', error.stack);
        console.error('Component stack:', errorInfo.componentStack);

        this.setState({
            error,
            errorInfo,
        });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return this.props.fallback || (
                <div style={{
                    padding: '20px',
                    border: '1px solid #ff6b6b',
                    borderRadius: '8px',
                    backgroundColor: '#ffe0e0',
                    color: '#d63031',
                    margin: '20px',
                }}>
                    <h2>Something went wrong</h2>
                    <details style={{ marginTop: '10px' }}>
                        <summary>Error Details</summary>
                        <pre style={{
                            marginTop: '10px',
                            padding: '10px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            overflow: 'auto',
                            fontSize: '12px'
                        }}>
                            {this.state.error && this.state.error.toString()}
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </details>
                    <button
                        onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                        style={{
                            marginTop: '10px',
                            padding: '8px 16px',
                            backgroundColor: '#ff6b6b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
