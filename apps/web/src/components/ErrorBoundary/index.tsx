import { Button } from '@mui/material';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { EmptyState } from 'src/components/EmptyState';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Ação do botão "Recarregar" (padrão: recarregar a página do navegador). */
  onReload?: () => void;
  /** Quando muda (ex.: a rota), o erro é esquecido e os filhos voltam a ser exibidos. */
  resetKey?: string;
}

/** Rede de segurança de um trecho da tela: se ele quebrar (ex.: falha ao baixar um chunk), o resto continua. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha ao exibir a página', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <EmptyState
        title="Não foi possível carregar esta página."
        description="Confira sua conexão e tente de novo."
        action={
          <Button variant="contained" onClick={this.props.onReload ?? (() => window.location.reload())}>
            Recarregar
          </Button>
        }
      />
    );
  }
}
