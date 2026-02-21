'use client'

import { InputHTMLAttributes, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormikField } from '@/lib/useFormikField'

interface CustomPasswordProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  name: string
  error?: string
  formGroupClass?: string
}

export function CustomPassword({
  label,
  name,
  error: externalError,
  formGroupClass,
  className,
  value: externalValue,
  onChange: externalOnChange,
  onBlur: externalOnBlur,
  ...props
}: CustomPasswordProps) {
  const [show, setShow] = useState(false)
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
      <div className="relative">
        <input
          id={name}
          name={name}
          type={show ? 'text' : 'password'}
          value={inputValue as string}
          onChange={inputOnChange as React.ChangeEventHandler<HTMLInputElement>}
          onBlur={inputOnBlur as React.FocusEventHandler<HTMLInputElement>}
          className={cn('form-control pr-10', displayError && 'is-invalid', className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      {displayError && (
        <p className="text-destructive text-xs font-light mt-1.5 pl-3">{displayError}</p>
      )}
    </div>
  )
}
