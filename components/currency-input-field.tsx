import CurrencyInput from "react-currency-input-field";
import { forwardRef, type InputHTMLAttributes } from "react";

interface CurrencyInputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  value?: number | string;
  onValueChange?: (value?: number) => void;
  currency?: string;
  decimalsLimit?: number;
  placeholder?: string;
  prefix?: string;
  className?: string;
  error?: string;
}

export const CurrencyInputField = forwardRef<HTMLInputElement, CurrencyInputFieldProps>(
  (
    {
      value,
      onValueChange,
      currency = "USD",
      decimalsLimit = 2,
      placeholder = "0.00",
      prefix = "$ ",
      className = "",
      error,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        <CurrencyInput
          ref={ref}
          value={value}
          onValueChange={onValueChange}
          decimalsLimit={decimalsLimit}
          prefix={prefix}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-2 rounded-lg border-2 border-slate-200
            focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20
            dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50
            dark:focus:border-mint dark:focus:ring-mint/20
            transition-colors duration-200
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${error ? "border-red-500 dark:border-red-500" : ""}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

CurrencyInputField.displayName = "CurrencyInputField";
