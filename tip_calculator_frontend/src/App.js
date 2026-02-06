import React, { useMemo, useRef, useState } from 'react';
import './App.css';

const TIP_PRESETS = [10, 15, 18, 20];

/**
 * Coerce a string from an <input type="number"> into a number for calculations.
 * - Empty string -> 0
 * - NaN -> 0
 * - Negative values are allowed for validation messaging, but callers may clamp for calculation.
 */
function coerceNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Format a number as USD currency with 2 decimals. */
function formatCurrency(amount) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `$${safe.toFixed(2)}`;
}

// PUBLIC_INTERFACE
function App() {
  /** Raw strings to keep the inputs controlled and robust to intermediate typing states. */
  const [billInput, setBillInput] = useState('');
  const [selectedTip, setSelectedTip] = useState(15);
  const [customTipInput, setCustomTipInput] = useState('');
  const lastPresetTipRef = useRef(15);

  const billRaw = useMemo(() => coerceNumber(billInput), [billInput]);
  const customTipRaw = useMemo(() => coerceNumber(customTipInput), [customTipInput]);

  const isCustomActive = customTipInput !== '';
  const activeTipPercent = isCustomActive ? customTipRaw : selectedTip;

  const billForCalc = Math.max(0, billRaw);
  const tipPercentForCalc = Math.max(0, activeTipPercent);

  const tipAmount = useMemo(() => {
    return billForCalc * (tipPercentForCalc / 100);
  }, [billForCalc, tipPercentForCalc]);

  const totalAmount = useMemo(() => {
    return billForCalc + tipAmount;
  }, [billForCalc, tipAmount]);

  const billHasError = billRaw < 0;
  const tipHasError = activeTipPercent < 0;

  // PUBLIC_INTERFACE
  const onBillChange = (e) => {
    // Keep as string for controlled input; calculation will coerce safely.
    setBillInput(e.target.value);
  };

  // PUBLIC_INTERFACE
  const onSelectPreset = (pct) => {
    setSelectedTip(pct);
    lastPresetTipRef.current = pct;
    // Preset selection must deactivate custom.
    setCustomTipInput('');
  };

  // PUBLIC_INTERFACE
  const onCustomTipChange = (e) => {
    const next = e.target.value;

    // If user starts typing a custom value, deselect presets (active source becomes custom).
    setCustomTipInput(next);

    // If user clears custom, restore the last selected preset as active.
    if (next === '') {
      setSelectedTip(lastPresetTipRef.current);
    }
  };

  const billHelperId = 'bill-helper';
  const tipHelperId = 'tip-helper';
  const resultsLiveId = 'results-live';

  return (
    <div className="App">
      <main className="page">
        <section className="card" aria-labelledby="tipcalc-title">
          <header className="cardHeader">
            <h1 id="tipcalc-title" className="title">
              Tip Calculator
            </h1>
            <p className="subtitle">
              Enter your bill and choose a tip percentage. Results update instantly.
            </p>
          </header>

          <div className="form">
            <div className="field">
              <label className="label" htmlFor="billAmount">
                Bill Amount
              </label>
              <div className="inputRow">
                <span className="prefix" aria-hidden="true">
                  $
                </span>
                <input
                  id="billAmount"
                  name="billAmount"
                  className={`input ${billHasError ? 'inputError' : ''}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={billInput}
                  onChange={onBillChange}
                  aria-describedby={billHelperId}
                  aria-invalid={billHasError ? 'true' : 'false'}
                />
              </div>
              <p id={billHelperId} className={`helper ${billHasError ? 'helperError' : ''}`}>
                {billHasError ? 'Please enter a non-negative amount.' : 'Enter the total before tip.'}
              </p>
            </div>

            <div className="field">
              <div className="labelRow">
                <label className="label" id="tipPercentLabel" htmlFor="customTip">
                  Tip Percentage
                </label>
                <span className="chip" aria-label="Active tip percentage">
                  {`${Math.max(0, activeTipPercent)}%`}
                </span>
              </div>

              <div className="tipGrid" role="group" aria-labelledby="tipPercentLabel">
                <div className="presetGroup" role="group" aria-label="Tip presets">
                  {TIP_PRESETS.map((pct) => {
                    const pressed = !isCustomActive && selectedTip === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        className={`presetBtn ${pressed ? 'presetBtnActive' : ''}`}
                        onClick={() => onSelectPreset(pct)}
                        aria-pressed={pressed ? 'true' : 'false'}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>

                <div className="customWrap">
                  <label className="srOnly" htmlFor="customTip">
                    Custom tip percentage
                  </label>
                  <div className="inputRow">
                    <input
                      id="customTip"
                      name="customTip"
                      className={`input ${tipHasError ? 'inputError' : ''}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="Custom %"
                      value={customTipInput}
                      onChange={onCustomTipChange}
                      aria-describedby={tipHelperId}
                      aria-invalid={tipHasError ? 'true' : 'false'}
                    />
                    <span className="suffix" aria-hidden="true">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <p id={tipHelperId} className={`helper ${tipHasError ? 'helperError' : ''}`}>
                {tipHasError
                  ? 'Please enter a non-negative tip percentage.'
                  : 'Choose a preset or enter a custom tip.'}
              </p>
            </div>

            <hr className="divider" />

            <section className="results" aria-labelledby="results-title">
              <h2 id="results-title" className="resultsTitle">
                Results
              </h2>

              <div
                id={resultsLiveId}
                className="resultsPanel"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="resultRow">
                  <span className="resultLabel">Tip Amount</span>
                  <span className="resultValue accent">{formatCurrency(tipAmount)}</span>
                </div>
                <div className="resultRow">
                  <span className="resultLabel">Total</span>
                  <span className="resultValue total">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <p className="helper">
                Outputs are rounded for display. Invalid entries are treated as $0.00 for calculation.
              </p>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
