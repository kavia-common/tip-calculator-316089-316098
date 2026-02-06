import { render, screen } from '@testing-library/react';
import App from './App';

test('renders tip calculator heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /tip calculator/i })).toBeInTheDocument();
});
