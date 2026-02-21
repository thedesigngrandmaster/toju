'use client'

import { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { useFormikField } from '@/lib/useFormikField'

interface CustomInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  name: string
  error?: string
  formGroupClass?: string
}

export function CustomInput({
  label,
  name,
  error: externalError,
  formGroupClass,
  className,
  value: externalValue,
  onChange: externalOnChange,
  onBlur: externalOnBlur,
  ...props
}: CustomInputProps) {
  const formik = useFormikField(name)

  const inputValue = formik ? formik.value : externalValue
  const inputOnChange = formik ? formik.onChange : externalOnChange
  const inputOnBlur = formik ? formik.onBlur : externalOnBlur
  const displayError = externalError || formik?.error

  return (
    <div className={cn('form-group', formGroupClass)}>
      {label && (
        <label htmlFor={name} className="form-label">
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        value={inputValue as string}
        onChange={inputOnChange as React.ChangeEventHandler<HTMLInputElement>}
        onBlur={inputOnBlur as React.FocusEventHandler<HTMLInputElement>}
        className={cn('form-control', displayError && 'is-invalid', className)}
        {...props}
      />
      {displayError && (
        <p className="text-destructive text-xs font-light mt-1.5 pl-3">{displayError}</p>
      )}
    </div>
  )
}
