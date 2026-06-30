import CurrencyInput, { type CurrencyInputProps } from "react-currency-input-field";
import { forwardRef } from "react";

interface CurrencyInputFieldProps extends Omit<CurrencyInputProps, "value" | "defaultValue" | "className"> {
  value?: string | number;
  defaultValue?: string | number;
  className?: string;
  error?: string;
}

export const CurrencyInputField = forwardRef<HTMLInputElement, CurrencyInputFieldProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      decimalsLimit = 2,
      placeholder = "0.00",
      prefix = "$ ",
      className = "",
      error,
      disabled,
      id,
      name,
      maxLength,
      allowDecimals,
      allowNegativeValue,
      decimalSeparator,
      groupSeparator,
      suffix
    },
    ref
  ) => {
    const inputValue = value ?? defaultValue ?? "";

    return (
      <div className="w-full">
        <CurrencyInput
          ref={ref}
          value={inputValue}
          defaultValue={typeof defaultValue === "undefined" ? undefined : String(defaultValue)}
          onValueChange={onValueChange}
          decimalsLimit={decimalsLimit}
          prefix={prefix}
          suffix={suffix}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          allowDecimals={allowDecimals}
          allowNegativeValue={allowNegativeValue}
          decimalSeparator={decimalSeparator}
          groupSeparator={groupSeparator}
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
        />
        {error && <p className="mt-1 text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

CurrencyInputField.displayName = "CurrencyInputField";
