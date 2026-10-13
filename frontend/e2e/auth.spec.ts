import {
  type Page,
  test,
  expect,
  PASSWORD,
  authHeaders,
  createWorkspace,
  errorToast,
  loginUser,
  registerUser,
  storedToken,
  uniqueEmail,
} from './fixtures'

async function fillRegisterForm(
  page: Page,
  email: string,
  password: string,
  confirm = password,
  name = 'Ada Lovelace'
) {
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm Password').fill(confirm)
}

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
}

const logoutButton = (page: Page) => page.getByRole('button', { name: 'Logout' })
// A signed-in user without a workspace lands on onboarding (AUTH-3, WS-1).
const onboardingHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Create a new workspace' })
const loginLink = (page: Page) => page.getByRole('link', { name: 'Login', exact: true })
const sessionExpiredToast = (page: Page) =>
  page.locator('[data-sonner-toast]').filter({ hasText: SESSION_EXPIRED })

// Fixed text the app shows when the backend rejects the session (src/lib/api-client.ts).
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'

test('the home page offers sign-in and registration to anonymous users', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Plan and build products, together.'
  )
  await expect(loginLink(page)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign Up', exact: true })).toBeVisible()
  await expect(logoutButton(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Items' })).toHaveCount(0)

  // The hero's call to action (the page repeats it at the bottom).
  await page.getByRole('link', { name: 'Sign In', exact: true }).first().click()
  await expect(page).toHaveURL('/login')
  // A fresh load, not goBack(): a click during the router's back navigation can be lost.
  await page.goto('/')
  await page.getByRole('link', { name: 'Get Started' }).click()
  await expect(page).toHaveURL('/register')
})

test.describe('register', () => {
  test('creates the account and signs the user in', async ({ page, api }) => {
    const email = uniqueEmail('register')
    await page.goto('/register')
    await fillRegisterForm(page, email, PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL('/onboarding')
    await expect(onboardingHeading(page)).toBeVisible()
    await expect(page.getByText(`Logged in as ${email}`)).toBeVisible()
    // The account exists on the backend: the same credentials sign in.
    const token = await loginUser(api, email, PASSWORD)
    expect(token).toMatch(/\S/)
    // The name from the form is the display name.
    const me = await api.get('/users/me', { headers: authHeaders({ token }) })
    expect((await me.json()).display_name).toBe('Ada Lovelace')
  })

  test('shows the backend error when the email is already registered', async ({ page, user }) => {
    await page.goto('/register')
    await fillRegisterForm(page, user.email, PASSWORD)
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/register'))
    await page.getByRole('button', { name: 'Create account' }).click()

    // Pins today's backend contract for a duplicate: 400 with error_code 'duplicate_item'.
    const response = await responsePromise
    expect(response.status()).toBe(400)
    const { detail, error_code } = await response.json()
    expect(error_code).toBe('duplicate_item')
    await expect(errorToast(page)).toContainText('Registration failed')
    await expect(errorToast(page)).toContainText(detail)
    await expect(page).toHaveURL('/register')
    await expect(loginLink(page)).toBeVisible()
  })

  test('validates the form in the browser before calling the backend', async ({ page }) => {
    const registerCalls: string[] = []
    page.on('request', request => {
      if (request.url().endsWith('/auth/register')) registerCalls.push(request.url())
    })
    await page.goto('/register')
    await fillRegisterForm(page, 'not-an-email', 'short', 'different', '   ')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Invalid email address')).toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
    await expect(page.getByText("Passwords don't match")).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(registerCalls).toEqual([])
  })

  test('shows backend validation errors (422) as a readable message', async ({ page }) => {
    // The form accepts this address; the backend rejects reserved TLDs such as .test.
    await page.goto('/register')
    await fillRegisterForm(page, `e2e-${Date.now()}@example.test`, PASSWORD)
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/register'))
    await page.getByRole('button', { name: 'Create account' }).click()

    expect((await responsePromise).status()).toBe(422)
    await expect(errorToast(page)).toContainText('Registration failed')
    await expect(errorToast(page)).toContainText('email: value is not a valid email address')
    await expect(page).toHaveURL('/register')
  })
})

test.describe('login', () => {
  test('signs in with the right password', async ({ page, user }) => {
    await page.goto('/login')
    await fillLoginForm(page, user.email, user.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/onboarding')
    await expect(onboardingHeading(page)).toBeVisible()
  })

  test('a user with a workspace goes to its My issues after sign-in', async ({
    page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user, { name: 'Sign-in Co' })
    await page.goto('/login')
    await fillLoginForm(page, user.email, user.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(`/${workspace.url_key}/my-issues`)
  })

  test('signing in as another user over a session shows only the new user', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const other = await registerUser(api)
    // Signed in, without a workspace: "/" opens onboarding, which shows the user.
    await page.goto('/')
    await expect(page).toHaveURL('/onboarding')
    await expect(page.getByText(`Logged in as ${user.email}`)).toBeVisible()

    // In-app navigation only, so the first user's cached data is still there.
    await page.getByRole('link', { name: 'Use another account' }).click()
    await expect(page).toHaveURL('/login')
    await fillLoginForm(page, other.email, other.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/onboarding')

    await expect(page.getByText(`Logged in as ${other.email}`)).toBeVisible()
    await expect(page.getByText(user.email)).toHaveCount(0)
    expect(await storedToken(page)).not.toBe(user.token)
    // The replaced session is revoked on the server, not only forgotten.
    await expect
      .poll(async () => (await api.get('/items', { headers: authHeaders(user) })).status())
      .toBe(401)
  })

  test('accepts the email in any letter case', async ({ page, user }) => {
    // The backend stores and compares emails in lowercase.
    await page.goto('/login')
    await fillLoginForm(page, user.email.toUpperCase(), user.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/onboarding')
    await expect(onboardingHeading(page)).toBeVisible()
  })

  test('ignores a redirect target that is not a path in the app', async ({ page, user }) => {
    for (const target of ['https://example.org/', '//example.org/', 'javascript:alert(1)']) {
      await page.goto(`/login?redirect=${encodeURIComponent(target)}`)
      await fillLoginForm(page, user.email, user.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/onboarding')
      await page.getByRole('button', { name: 'Log out' }).click()
      await expect(page).toHaveURL('/login')
    }
  })

  test('shows the backend error for a wrong password', async ({ page, user }) => {
    await page.goto('/login')
    await fillLoginForm(page, user.email, 'Wrong-Password-1')
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/login'))
    await page.getByRole('button', { name: 'Sign in' }).click()

    const response = await responsePromise
    expect(response.status()).toBe(401)
    const { detail } = await response.json()
    await expect(errorToast(page)).toContainText('Login failed')
    await expect(errorToast(page)).toContainText(detail)
    await expect(page).toHaveURL('/login')
    await expect(loginLink(page)).toBeVisible()
  })

  test('a wrong password does not sign out a signed-in user', async ({
    authedPage: page,
    user,
  }) => {
    await page.goto('/login')
    const token = await storedToken(page)
    expect(token).not.toBeNull()
    await fillLoginForm(page, user.email, 'Wrong-Password-1')
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/login'))
    await page.getByRole('button', { name: 'Sign in' }).click()

    const response = await responsePromise
    expect(response.status()).toBe(401)
    expect(response.request().headers()['authorization']).toBeUndefined()
    const { detail } = await response.json()
    await expect(errorToast(page)).toContainText('Login failed')
    await expect(errorToast(page)).toContainText(detail)
    await expect(errorToast(page)).not.toContainText(SESSION_EXPIRED)
    expect(await storedToken(page)).toBe(token)

    await page.goto('/items')
    await expect(page).toHaveURL('/items')
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
  })

  test('requires email and password', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email address')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('links to the register page and back', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Create account' }).click()
    await expect(page).toHaveURL('/register')
    await page.getByRole('main').getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/login')
  })
})

test.describe('session', () => {
  test('a protected page sends anonymous users to login and back after sign-in', async ({
    page,
    user,
  }) => {
    await page.goto('/items')
    await expect(page).toHaveURL('/login?redirect=%2Fitems')

    await fillLoginForm(page, user.email, user.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/items')
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
  })

  test('survives a page reload', async ({ authedPage: page }) => {
    await page.goto('/items')
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL('/items')
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
    await expect(logoutButton(page)).toBeVisible()
  })

  test('logout ends the session on the backend too', async ({ authedPage: page, user, api }) => {
    // Not "/": it redirects to onboarding, which can remove the button before the click.
    await page.goto('/items')
    await expect(page.getByText('No items yet')).toBeVisible()
    await logoutButton(page).click()

    await expect(page).toHaveURL('/login')
    await expect(loginLink(page)).toBeVisible()
    expect(await storedToken(page)).toBeNull()
    expect((await api.get('/items', { headers: authHeaders(user) })).status()).toBe(401)

    await page.goto('/items')
    await expect(page).toHaveURL('/login?redirect=%2Fitems')
  })

  test('a session revoked on the backend sends the user to login', async ({
    authedPage: page,
    user,
    api,
  }) => {
    await page.goto('/items')
    // The loaded list, not only the heading: the list request must end before
    // the revoke, or its 401 sends the page to login before the click below.
    await expect(page.getByText('No items yet')).toBeVisible()
    // Revoke the session elsewhere (another device, an admin, expiry).
    expect((await api.post('/auth/logout', { headers: authHeaders(user) })).ok()).toBe(true)

    await page.getByRole('button', { name: 'Create Item' }).click()
    await page.getByLabel('Name').fill('Never saved')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Back to login, and back to this page after signing in again.
    await expect(page).toHaveURL('/login?redirect=%2Fitems')
    await expect(loginLink(page)).toBeVisible()
    await expect(sessionExpiredToast(page)).toBeVisible()
    expect(await storedToken(page)).toBeNull()
  })

  test('logout in one tab signs out the other tab on its next request', async ({
    authedPage: page,
  }) => {
    const otherTab = await page.context().newPage()
    await otherTab.goto('/items')
    // Wait for the loaded list, so no list request is still running at logout.
    await expect(otherTab.getByText('No items yet')).toBeVisible()

    // ("/" would open onboarding: the user has no workspace.)
    await page.goto('/items')
    await logoutButton(page).click()
    await expect(page).toHaveURL('/login')

    // The other tab still shows the items page. Its next call goes out without a
    // token: FastAPI's HTTPBearer answers 403 "Not authenticated" (401 in newer
    // FastAPI versions). The app treats both as a dead session.
    await otherTab.getByRole('button', { name: 'Create Item' }).click()
    await otherTab.getByLabel('Name').fill('Never saved')
    const responsePromise = otherTab.waitForResponse(r => r.url().endsWith('/items'))
    await otherTab.getByRole('button', { name: 'Create', exact: true }).click()

    expect([401, 403]).toContain((await responsePromise).status())
    await expect(otherTab).toHaveURL('/login?redirect=%2Fitems')
    await expect(loginLink(otherTab)).toBeVisible()
    await expect(sessionExpiredToast(otherTab)).toBeVisible()
  })
})
