import React, { useMemo, useRef, useState } from 'react';
import './App.css';

const TIP_PRESETS = [10, 15, 18, 20];

const ROUNDING_MODES = {
  NONE: 'none',
  TIP: 'tip',
  TOTAL: 'total',
};

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

/** Round to the nearest whole currency unit (e.g., dollars). */
function roundToWholeCurrency(amount) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return Math.round(safe);
}

// PUBLIC_INTERFACE
function App() {
  /** Raw strings to keep the inputs controlled and robust to intermediate typing states. */
  const [billInput, setBillInput] = useState('');
  const [selectedTip, setSelectedTip] = useState(15);
  const [customTipInput, setCustomTipInput] = useState('');
  const lastPresetTipRef = useRef(15);

  const [peopleInput, setPeopleInput] = useState('1');
  const [roundingMode, setRoundingMode] = useState(ROUNDING_MODES.NONE);

  const billRaw = useMemo(() => coerceNumber(billInput), [billInput]);
  const customTipRaw = useMemo(() => coerceNumber(customTipInput), [customTipInput]);
  const peopleRaw = useMemo(() => coerceNumber(peopleInput), [peopleInput]);

  const isCustomActive = customTipInput !== '';
  const activeTipPercent = isCustomActive ? customTipRaw : selectedTip;

  const billForCalc = Math.max(0, billRaw);
  const tipPercentForCalc = Math.max(0, activeTipPercent);

  const baseTipAmount = useMemo(() => {
    return billForCalc * (tipPercentForCalc / 100);
  }, [billForCalc, tipPercentForCalc]);

  const baseTotalAmount = useMemo(() => {
    return billForCalc + baseTipAmount;
  }, [billForCalc, baseTipAmount]);

  const billHasError = billRaw < 0;
  const tipHasError = activeTipPercent < 0;

  /**
   * Validation requirement: if people < 1, clamp to 1 and show an inline error state.
   * - We treat non-numeric as 0 -> clamped to 1 (and also treated as error state).
   */
  const peopleClamped = Math.max(1, Math.floor(peopleRaw || 0));
  const peopleHasError = peopleRaw < 1;

  /**
   * Apply rounding rules to overall (not per-person) amounts, then derive per-person
   * from those rounded values (per requirements).
   */
  const { tipAmount, totalAmount } = useMemo(() => {
    if (roundingMode === ROUNDING_MODES.TIP) {
      const roundedTip = roundToWholeCurrency(baseTipAmount);
      return { tipAmount: roundedTip, totalAmount: billForCalc + roundedTip };
    }

    if (roundingMode === ROUNDING_MODES.TOTAL) {
      const roundedTotal = roundToWholeCurrency(baseTotalAmount);
      // implied tip is roundedTotal - bill with floor at 0.00
      const impliedTip = Math.max(0, roundedTotal - billForCalc);
      return { tipAmount: impliedTip, totalAmount: billForCalc + impliedTip };
    }

    return { tipAmount: baseTipAmount, totalAmount: baseTotalAmount };
  }, [roundingMode, baseTipAmount, baseTotalAmount, billForCalc]);

  const perPersonTip = useMemo(() => {
    return tipAmount / peopleClamped;
  }, [tipAmount, peopleClamped]);

  const perPersonTotal = useMemo(() => {
    return totalAmount / peopleClamped;
  }, [totalAmount, peopleClamped]);

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

  // PUBLIC_INTERFACE
  const onPeopleChange = (e) => {
    /**
     * Deterministic clamping:
     * Normalize on every change so the controlled value is always a valid integer >= 1.
     *
     * Rationale: Some tests and CI environments can observe intermediate states before blur
     * fires or before state settles. By enforcing the invariant in onChange, we guarantee
     * consistent behavior.
     */
    const raw = e?.target?.value;

    // Empty input, non-numeric, or <= 0 => immediately coerce to "1"
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setPeopleInput('1');
      return;
    }

    // Coerce to integer >= 1
    const clampedInt = Math.max(1, Math.floor(n));
    setPeopleInput(String(clampedInt));
  };

  // PUBLIC_INTERFACE
  const onPeopleBlur = (e) => {
    /**
     * Clamp deterministically based on the *blur-time* input value, not memoized state.
     * This avoids any timing issues where `peopleRaw` could be stale relative to the user's last edit.
     *
     * Requirements:
     * - invalid / empty / non-numeric => clamp to 1
     * - < 1 (including 0) => clamp to 1
     */
    const raw = e?.target?.value;
    const n = Number(raw);

    if (!Number.isFinite(n) || n < 1) {
      setPeopleInput('1');
    }
  };

  // PUBLIC_INTERFACE
  const onRoundingModeChange = (e) => {
    setRoundingMode(e.target.value);
  };

  const billHelperId = 'bill-helper';
  const tipHelperId = 'tip-helper';
  const peopleHelperId = 'people-helper';
  const roundingHelperId = 'rounding-helper';
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

            <div className="controlRow" aria-label="Split and rounding controls">
              <div className="field narrow">
                <label className="label" htmlFor="peopleCount">
                  Number of people
                </label>
                <div className="inputRow" style={{ gridTemplateColumns: '1fr' }}>
                  <input
                    id="peopleCount"
                    name="peopleCount"
                    className={`input ${peopleHasError ? 'inputError' : ''}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={peopleInput}
                    onChange={onPeopleChange}
                    onBlur={onPeopleBlur}
                    aria-describedby={peopleHelperId}
                    aria-invalid={peopleHasError ? 'true' : 'false'}
                  />
                </div>
                <p
                  id={peopleHelperId}
                  className={`helper ${peopleHasError ? 'helperError' : ''}`}
                >
                  {peopleHasError
                    ? 'Minimum is 1 person. Value was clamped to 1.'
                    : 'Split totals across people.'}
                </p>
              </div>

              <div className="field">
                <div className="labelRow">
                  <span className="label" id="roundingLabel">
                    Rounding
                  </span>
                  <span className="chip" aria-label="Active rounding mode">
                    {roundingMode === ROUNDING_MODES.NONE
                      ? 'No rounding'
                      : roundingMode === ROUNDING_MODES.TIP
                        ? 'Round tip'
                        : 'Round total'}
                  </span>
                </div>

                <div
                  className="segmented"
                  role="radiogroup"
                  aria-labelledby="roundingLabel"
                  aria-describedby={roundingHelperId}
                >
                  <div className="segment">
                    <input
                      id="round-none"
                      type="radio"
                      name="roundingMode"
                      value={ROUNDING_MODES.NONE}
                      checked={roundingMode === ROUNDING_MODES.NONE}
                      onChange={onRoundingModeChange}
                    />
                    <label htmlFor="round-none">No rounding</label>
                  </div>

                  <div className="segment">
                    <input
                      id="round-tip"
                      type="radio"
                      name="roundingMode"
                      value={ROUNDING_MODES.TIP}
                      checked={roundingMode === ROUNDING_MODES.TIP}
                      onChange={onRoundingModeChange}
                    />
                    <label htmlFor="round-tip">Round tip</label>
                  </div>

                  <div className="segment">
                    <input
                      id="round-total"
                      type="radio"
                      name="roundingMode"
                      value={ROUNDING_MODES.TOTAL}
                      checked={roundingMode === ROUNDING_MODES.TOTAL}
                      onChange={onRoundingModeChange}
                    />
                    <label htmlFor="round-total">Round total</label>
                  </div>
                </div>

                <p id={roundingHelperId} className="helper">
                  No rounding keeps cents. “Round tip” rounds the tip to whole dollars; “Round total”
                  rounds the overall total and implies the tip.
                </p>
              </div>
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

                {peopleClamped > 1 ? (
                  <>
                    <div className="resultRow">
                      <span className="resultLabel">{`Tip / person (${peopleClamped})`}</span>
                      <span className="resultValue accent">{formatCurrency(perPersonTip)}</span>
                    </div>
                    <div className="resultRow">
                      <span className="resultLabel">{`Total / person (${peopleClamped})`}</span>
                      <span className="resultValue">{formatCurrency(perPersonTotal)}</span>
                    </div>
                  </>
                ) : null}
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
