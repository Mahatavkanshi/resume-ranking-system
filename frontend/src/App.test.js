import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app title and form controls', () => {
  render(<App />);
  expect(screen.getByText(/talent match studio/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/job description/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
});
