import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import './YesNoSelector.css';

interface YesNoSelectorProps {
  /**
   * The question or prompt to display above the yes/no options
   */
  prompt: string;
  
  /**
   * The initial selected value (true for Yes, false for No, undefined for nothing selected)
   */
  initialValue?: boolean | undefined;
  
  /**
   * Callback function that fires when selection changes
   * @param value - The new selected value (true for Yes, false for No, undefined if deselected)
   */
  onChange: (value: boolean | undefined) => void;
  
  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;
  
  /**
   * Whether a selection is required (if true, users cannot deselect options)
   */
  required?: boolean;
}

/**
 * A component that allows users to select between Yes and No options
 * with keyboard navigation support (arrow keys and Enter)
 */
const YesNoSelector: React.FC<YesNoSelectorProps> = ({
  prompt,
  initialValue,
  onChange,
  disabled = false,
  required = false,
}) => {
  const [selectedValue, setSelectedValue] = useState<boolean | undefined>(initialValue);
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle when user clicks on an option
  const handleOptionClick = (value: boolean) => {
    // If the user clicks on the already selected option and it's not required,
    // toggle it off (deselect)
    if (value === selectedValue && !required) {
      setSelectedValue(undefined);
      onChange(undefined);
    } else {
      setSelectedValue(value);
      onChange(value);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        // If left arrow pressed, select "No", if right arrow pressed, select "Yes"
        // If nothing is currently selected, select the appropriate option
        // If something is already selected, toggle between options
        if (e.key === 'ArrowLeft') {
          setSelectedValue(false);
          onChange(false);
          noButtonRef.current?.focus();
        } else {
          setSelectedValue(true);
          onChange(true);
          yesButtonRef.current?.focus();
        }
        break;
      case 'Enter':
        // If focus is on the container, focus the selected button
        if (e.target === containerRef.current) {
          if (selectedValue === true) {
            yesButtonRef.current?.focus();
          } else if (selectedValue === false) {
            noButtonRef.current?.focus();
          }
        }
        break;
      default:
        break;
    }
  };

  // Focus the selected button when component mounts
  useEffect(() => {
    if (initialValue === true) {
      yesButtonRef.current?.focus();
    } else if (initialValue === false) {
      noButtonRef.current?.focus();
    }
  }, [initialValue]);

  return (
    <div 
      className="yes-no-selector"
      role="radiogroup"
      aria-labelledby="selector-prompt"
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      ref={containerRef}
      aria-disabled={disabled}
    >
      <div id="selector-prompt" className="selector-prompt">
        {prompt}
        {required && <span className="required-indicator"> *</span>}
      </div>
      
      <div className="selector-options">
        <button
          type="button"
          ref={yesButtonRef}
          className={`option-button yes-button ${selectedValue === true ? 'selected' : ''}`}
          onClick={() => handleOptionClick(true)}
          disabled={disabled}
          aria-pressed={selectedValue === true}
          aria-disabled={disabled}
        >
          Yes
        </button>
        
        <button
          type="button"
          ref={noButtonRef}
          className={`option-button no-button ${selectedValue === false ? 'selected' : ''}`}
          onClick={() => handleOptionClick(false)}
          disabled={disabled}
          aria-pressed={selectedValue === false}
          aria-disabled={disabled}
        >
          No
        </button>
      </div>
      
      {!disabled && (
        <div className="keyboard-hint">
          Use ← and → keys to navigate
        </div>
      )}
    </div>
  );
};

export default YesNoSelector; 