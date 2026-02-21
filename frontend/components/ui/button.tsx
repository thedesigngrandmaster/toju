'use client'

import { Button as NextUIButton } from '@nextui-org/react'
import type { ButtonProps as NextUIButtonProps } from '@nextui-org/react'
import { Spinner } from '@nextui-org/react'
import { cn } from '@/lib/utils'

interface ButtonProps extends Omit<NextUIButtonProps, 'loading'> {
  loading?: boolean
}

export function Button({
  loading = false,
  children,
  className,
  isDisabled,
  disabled,
  radius = 'full',
  size = 'md',
  ...props
}: ButtonProps) {
  const isOff = isDisabled || disabled || loading

  return (
    <NextUIButton
      {...props}
      radius={radius}
      size={size}
      isDisabled={isOff}
      className={cn('text-xs font-medium shadow-none', className)}
    >
      {loading ? <Spinner size="sm" color="current" /> : children}
    </NextUIButton>
  )
}
