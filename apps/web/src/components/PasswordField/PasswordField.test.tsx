import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from 'src/components/PasswordField';

describe('PasswordField', () => {
  it('alterna a visibilidade do que foi digitado', async () => {
    render(<PasswordField label="Senha" />);
    const field = screen.getByLabelText('Senha');
    expect(field).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(field).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('respeita o slotProps.input do chamador', () => {
    render(<PasswordField label="Senha" slotProps={{ input: { inputProps: { maxLength: 8 }, startAdornment: <span>Chave</span> } }} />);
    expect(screen.getByLabelText('Senha')).toHaveAttribute('maxlength', '8');
    expect(screen.getByText('Chave')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument();
  });
});
