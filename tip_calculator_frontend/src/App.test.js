import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

function getBillInput() {
  return screen.getByRole('spinbutton', { name: /bill amount/i });
}

function getCustomTipInput() {
  // This input has an sr-only label "Custom tip percentage"
  return screen.getByRole('spinbutton', { name: /custom tip percentage/i });
}

function getTipPresetsGroup() {
  return screen.getByRole('group', { name: /tip presets/i });
}

function getPresetButton(pct) {
  return within(getTipPresetsGroup()).getByRole('button', { name: `${pct}%` });
}

/**
 * The results area uses plain text labels ("Tip Amount", "Total") with
 * values rendered next to them. We keep the query resilient by:
 * - finding the label text
 * - walking up to the row container
 * - reading the last span as the value
 */
function getResultValueForLabel(labelText) {
  const label = screen.getByText(labelText);
  const row = label.closest('div');
  if (!row) {
    throw new Error(`Could not find row container for label: ${labelText}`);
  }
  const spans = within(row).getAllByText(/\$/);
  // In each row there should be exactly one "$xx.xx" value.
  if (spans.length !== 1) {
    throw new Error(
      `Expected exactly 1 currency value in row for "${labelText}", got ${spans.length}`
    );
  }
  return spans[0];
}

function expectTipAndTotal({ tip, total }) {
  expect(getResultValueForLabel('Tip Amount')).toHaveTextContent(tip);
  expect(getResultValueForLabel('Total')).toHaveTextContent(total);
}

describe('Tip Calculator App', () => {
  test('renders main sections and key controls', () => {
    const { container } = render(<App />);

    // Heading / intro
    expect(screen.getByRole('heading', { name: /tip calculator/i })).toBeInTheDocument();
    expect(
      screen.getByText(/enter your bill and choose a tip percentage/i)
    ).toBeInTheDocument();

    // Bill input exists and is labeled
    expect(getBillInput()).toBeInTheDocument();

    // Tip controls: preset buttons group and custom input
    expect(screen.getByRole('group', { name: /tip presets/i })).toBeInTheDocument();
    expect(getPresetButton(10)).toBeInTheDocument();
    expect(getPresetButton(15)).toBeInTheDocument();
    expect(getPresetButton(18)).toBeInTheDocument();
    expect(getPresetButton(20)).toBeInTheDocument();
    expect(getCustomTipInput()).toBeInTheDocument();

    // Results area
    expect(screen.getByRole('heading', { name: /results/i })).toBeInTheDocument();
    expect(screen.getByText('Tip Amount')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();

    // Structural sanity snapshot (kept lightweight; focuses on core layout stability)
    expect(container.querySelector('#tipcalc-title')).toMatchSnapshot();
  });

  test('initial state: default selected tip preset is 15% and outputs are $0.00', () => {
    render(<App />);

    expect(getPresetButton(15)).toHaveAttribute('aria-pressed', 'true');
    expect(getPresetButton(10)).toHaveAttribute('aria-pressed', 'false');

    expectTipAndTotal({ tip: '$0.00', total: '$0.00' });

    // Active tip percentage chip should reflect 15%
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('15%');
  });

  test('entering a bill amount updates tip and total with currency formatting to 2 decimals', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default tip is 15%.
    await user.clear(getBillInput());
    await user.type(getBillInput(), '100');

    expectTipAndTotal({ tip: '$15.00', total: '$115.00' });
  });

  test('selecting preset percentages recomputes tip/total live', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(getBillInput(), '50');

    await user.click(getPresetButton(10));
    expect(getPresetButton(10)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('10%');
    expectTipAndTotal({ tip: '$5.00', total: '$55.00' });

    await user.click(getPresetButton(20));
    expect(getPresetButton(20)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('20%');
    expectTipAndTotal({ tip: '$10.00', total: '$60.00' });
  });

  test('typing a custom tip percentage takes precedence over presets and clears preset active state', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(getBillInput(), '200');

    // Start from preset 15%
    expect(getPresetButton(15)).toHaveAttribute('aria-pressed', 'true');

    await user.type(getCustomTipInput(), '25');

    // When custom is active, no preset should be pressed (all aria-pressed false)
    expect(getPresetButton(10)).toHaveAttribute('aria-pressed', 'false');
    expect(getPresetButton(15)).toHaveAttribute('aria-pressed', 'false');
    expect(getPresetButton(18)).toHaveAttribute('aria-pressed', 'false');
    expect(getPresetButton(20)).toHaveAttribute('aria-pressed', 'false');

    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('25%');
    expectTipAndTotal({ tip: '$50.00', total: '$250.00' });
  });

  test('clearing custom tip restores last selected preset as active', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(getBillInput(), '80');

    // Select a preset that is not the initial one, to verify restore behavior.
    await user.click(getPresetButton(18));
    expect(getPresetButton(18)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('18%');
    expectTipAndTotal({ tip: '$14.40', total: '$94.40' });

    // Activate custom
    await user.type(getCustomTipInput(), '5');
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('5%');
    expectTipAndTotal({ tip: '$4.00', total: '$84.00' });

    // Clear custom -> should restore last preset (18%)
    await user.clear(getCustomTipInput());
    expect(getPresetButton(18)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('18%');
    expectTipAndTotal({ tip: '$14.40', total: '$94.40' });
  });

  test('clearing bill input returns values to $0.00 (safe no-crash behavior)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(getBillInput(), '123.45');
    expect(getResultValueForLabel('Total')).toHaveTextContent('$');

    await user.clear(getBillInput());
    expectTipAndTotal({ tip: '$0.00', total: '$0.00' });
  });

  test('validation edge cases: negative bill shows error state and calculations clamp to $0.00', () => {
    render(<App />);

    const billInput = getBillInput();
    // fireEvent used to set raw negative values even if the browser might constrain typing.
    fireEvent.change(billInput, { target: { value: '-10' } });

    expect(billInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/please enter a non-negative amount/i)).toBeInTheDocument();

    // Calculations should treat invalid entries as safe values (clamp to 0)
    expectTipAndTotal({ tip: '$0.00', total: '$0.00' });
  });

  test('validation edge cases: negative custom tip shows error state and tip clamps to 0%', () => {
    render(<App />);

    const billInput = getBillInput();
    fireEvent.change(billInput, { target: { value: '100' } });

    const customTip = getCustomTipInput();
    fireEvent.change(customTip, { target: { value: '-5' } });

    expect(customTip).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/please enter a non-negative tip percentage/i)).toBeInTheDocument();

    // tipPercent clamps to 0 => no tip
    expectTipAndTotal({ tip: '$0.00', total: '$100.00' });
    // Active percentage chip uses Math.max(0, activeTipPercent)
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('0%');
  });

  test('empty inputs: bill empty and custom empty keeps safe $0.00 values and default tip', () => {
    render(<App />);

    expect(getBillInput()).toHaveValue(null); // empty number input reports null
    expect(getCustomTipInput()).toHaveValue(null);

    expect(getPresetButton(15)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/active tip percentage/i)).toHaveTextContent('15%');

    expectTipAndTotal({ tip: '$0.00', total: '$0.00' });
  });

  test('non-numeric values do not crash and result in safe $0.00 values', () => {
    render(<App />);

    // Even though input type is number, programmatic change can still attempt non-numeric strings.
    fireEvent.change(getBillInput(), { target: { value: 'abc' } });
    fireEvent.change(getCustomTipInput(), { target: { value: 'xyz' } });

    expectTipAndTotal({ tip: '$0.00', total: '$0.00' });
  });

  test('zero bill always yields $0.00 tip and $0.00 total regardless of tip percent', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(getBillInput(), '0');
    await user.click(getPresetButton(20));
    expectTipAndTotal({ tip: '$0.00', total: '$0.00' });

    await user.type(getCustomTipInput(), '99');
    expectTipAndTotal({ tip: '$0.00', total: '$0.00' });
  });

  test('extremely large numbers: app remains stable and keeps 2-decimal formatting', () => {
    render(<App />);

    fireEvent.change(getBillInput(), { target: { value: '1000000000000' } }); // 1e12
    fireEvent.change(getCustomTipInput(), { target: { value: '20' } });

    // 20% of 1e12 = 2e11; total = 1.2e12
    expectTipAndTotal({ tip: '$200000000000.00', total: '$1200000000000.00' });
  });

  test('accessibility: key inputs are reachable by their labels', () => {
    render(<App />);

    // If these queries work, labels are correctly associated.
    expect(screen.getByLabelText(/bill amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/custom tip percentage/i)).toBeInTheDocument();

    // Groups should be discoverable by role + accessible name.
    expect(screen.getByRole('group', { name: /tip presets/i })).toBeInTheDocument();
  });
});
