import { screen } from '@testing-library/react';
import { StatusChip } from 'src/components/StatusChip';
import { renderWithProviders } from 'src/test/render';

describe('StatusChip', () => {
  it('mostra Ativo', () => {
    renderWithProviders(<StatusChip active />);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('mostra Inativo', () => {
    renderWithProviders(<StatusChip active={false} />);
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });
});
