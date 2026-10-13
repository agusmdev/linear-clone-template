import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { AuthFormShell } from '@/components/AuthFormShell'
import { EmailField, NameField, PasswordField } from '@/components/AuthFormFields'
import { API } from '@/lib/api-endpoints'
import { useAuthSubmit } from '@/hooks/useAuthSubmit'
import { useHydrated } from '@/hooks/useHydrated'
import {
  registerSchema,
  registerFormToPayload,
  type RegisterFormData,
  type RegisterPayload,
} from '@/features/auth/auth-schemas'

export const Route = createFileRoute('/register')({
  component: Register,
})

function Register() {
  const hydrated = useHydrated()
  const { submit, isLoading } = useAuthSubmit<RegisterPayload>(
    API.AUTH.REGISTER,
    'Account created successfully',
    'Registration failed'
  )

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  // Inert until hydrated, and while the request runs.
  const disabled = isLoading || !hydrated

  const onSubmit = (data: RegisterFormData) => submit(registerFormToPayload(data))

  return (
    <AuthFormShell
      title="Create your account"
      description="Plan, track and ship work with your team"
      footer={
        <div className="mt-6 text-center text-ui text-text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      }
    >
      <Form {...form}>
        {/* noValidate: the zod schema validates, so its messages show instead of the browser's. */}
        <form
          method="post"
          action="#"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3"
        >
          <NameField control={form.control} name="name" disabled={disabled} />
          <EmailField control={form.control} name="email" disabled={disabled} />
          <PasswordField
            control={form.control}
            name="password"
            disabled={disabled}
            autoComplete="new-password"
          />
          <PasswordField
            autoComplete="new-password"
            control={form.control}
            name="confirmPassword"
            disabled={disabled}
            label="Confirm Password"
          />
          <Button type="submit" size="lg" className="mt-2 w-full" disabled={disabled}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Form>
    </AuthFormShell>
  )
}
