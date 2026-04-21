import { render, screen } from '@testing-library/react';
import App from './App';

test('renders resume ranking title', () => {
  render(<App />);
  expect(screen.getByText(/resume ranking system/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/job description/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
});
