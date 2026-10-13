import { type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

interface AuthFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  disabled: boolean
}

export function EmailField<T extends FieldValues>({ control, name, disabled }: AuthFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-text-secondary">Email</FormLabel>
          <FormControl>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-10"
              {...field}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

interface PasswordFieldProps<T extends FieldValues> extends AuthFieldProps<T> {
  label?: string
  autoComplete?: 'current-password' | 'new-password'
}

export function PasswordField<T extends FieldValues>({
  control,
  name,
  disabled,
  label = 'Password',
  autoComplete = 'current-password',
}: PasswordFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-text-secondary">{label}</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete={autoComplete}
              placeholder="••••••••"
              className="h-10"
              {...field}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function NameField<T extends FieldValues>({ control, name, disabled }: AuthFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-text-secondary">Name</FormLabel>
          <FormControl>
            <Input
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              className="h-10"
              {...field}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
