import { useContext } from 'react'
import { FormikContext, getIn } from 'formik'

export function useFormikField(name: string) {
  const ctx = useContext(FormikContext)
  if (!ctx) return null

  const value = getIn(ctx.values, name)
  const touched = getIn(ctx.touched, name)
  const error = getIn(ctx.errors, name)

  return {
    value: value ?? '',
    onChange: ctx.handleChange,
    onBlur: ctx.handleBlur,
    error: touched && error ? (error as string) : undefined,
  }
}
