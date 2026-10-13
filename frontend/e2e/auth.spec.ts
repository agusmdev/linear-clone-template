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
const signInInstead = (page: Page) => page.getByRole('link', { name: 'Sign in instead' })
const sessionExpiredToast = (page: Page) =>
  page.locator('[data-sonner-toast]').filter({ hasText: SESSION_EXPIRED })

// Fixed text the app shows when the backend rejects the session (src/lib/api-client.ts).
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'
// The backend's detail for a taken email (app/user/auth/exceptions.py), shown under Email.
const EMAIL_TAKEN = 'An account with this email already exists'

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

  test('shows a clear error under Email when the email is already registered', async ({
    page,
    user,
  }) => {
    await page.goto('/register')
    await fillRegisterForm(page, user.email, PASSWORD)
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/register'))
    await page.getByRole('button', { name: 'Create account' }).click()

    // Backend contract for a taken email: 400 duplicate_item with a readable detail.
    const response = await responsePromise
    expect(response.status()).toBe(400)
    expect(await response.json()).toEqual({
      detail: EMAIL_TAKEN,
      error_code: 'duplicate_item',
    })
    // The message shows inline under Email (not the raw model wording, not a toast).
    const emailField = page.getByLabel('Email')
    await expect(emailField).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText(EMAIL_TAKEN)).toBeVisible()
    await expect(page.getByText(/Duplicate entry/)).toHaveCount(0)
    await expect(errorToast(page)).toHaveCount(0)
    await expect(signInInstead(page)).toBeVisible()
    await expect(page).toHaveURL('/register')

    // Editing the email clears the error and its sign-in link.
    await emailField.fill(uniqueEmail('register-retry'))
    await expect(page.getByText(EMAIL_TAKEN)).toHaveCount(0)
    await expect(signInInstead(page)).toHaveCount(0)

    // A second clash shows the link again, and it leads to sign-in.
    await emailField.fill(user.email)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText(EMAIL_TAKEN)).toBeVisible()
    await signInInstead(page).click()
    await expect(page).toHaveURL('/login')
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

  test('the onboarding header fits a phone screen, Log out included', async ({
    authedPage: page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto('/onboarding')
    await expect(onboardingHeading(page)).toBeVisible()

    const logOut = page.getByRole('button', { name: 'Log out' })
    const box = await logOut.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)

    await logOut.click()
    await expect(page).toHaveURL('/login')
  })

  test('onboarding lists a workspace with a long URL by name on a phone', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const name = 'Northwind Logistics Worldwide'
    const workspace = await createWorkspace(api, user, {
      name,
      url_key: `northwind-logistics-worldwide-${Date.now()}`,
    })
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/onboarding')

    const row = page.getByRole('link', { name: new RegExp(name) })
    await expect(row).toBeVisible()
    // The long URL key is cut short; the name keeps room to show.
    const nameBox = await row.getByText(name, { exact: true }).boundingBox()
    expect(nameBox).not.toBeNull()
    expect(nameBox!.width).toBeGreaterThan(60)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await row.click()
    await expect(page).toHaveURL(`/${workspace.url_key}/my-issues`)
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

  test('shows the same generic error for an unknown email and a wrong password', async ({
    page,
    user,
  }) => {
    const errors: { status: number; body: unknown }[] = []
    for (const email of [user.email, `nobody-${Date.now()}@example.com`]) {
      await page.goto('/login')
      await fillLoginForm(page, email, 'Wrong-Password-1')
      const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/login'))
      await page.getByRole('button', { name: 'Sign in' }).click()
      const response = await responsePromise
      errors.push({ status: response.status(), body: await response.json() })
      await expect(errorToast(page)).toContainText('Invalid email or password')
    }

    // The response must not tell which emails have an account.
    expect(errors[0]).toEqual({
      status: 401,
      body: { detail: 'Invalid email or password', error_code: 'invalid_credentials' },
    })
    expect(errors[1]).toEqual(errors[0])
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
    // Not '/': it redirects a user with no workspace to onboarding, which has
    // no Logout button, so a click there can race the redirect.
    await page.goto('/items')
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
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

  test('logout in one tab signs out the other tab at once', async ({ authedPage: page }) => {
    const otherTab = await page.context().newPage()
    await otherTab.goto('/items')
    // Wait for the loaded list, so no list request is still running at logout.
    await expect(otherTab.getByText('No items yet')).toBeVisible()

    // ("/" would open onboarding: the user has no workspace.)
    await page.goto('/items')
    await logoutButton(page).click()
    await expect(page).toHaveURL('/login')

    // The other tab hears the token go (a storage event) and leaves the page
    // without waiting for its next request, and comes back here after sign-in.
    await expect(otherTab).toHaveURL('/login?redirect=%2Fitems')
    await expect(loginLink(otherTab)).toBeVisible()
    expect(await storedToken(otherTab)).toBeNull()
  })

  test('signing in as another user in one tab moves the other tab to that user', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const mine = await createWorkspace(api, user, { name: 'First Tab Co' })
    const other = await registerUser(api)
    const theirs = await createWorkspace(api, other, { name: 'Other Tab Co' })
    await page.goto(`/${mine.url_key}/my-issues`)
    await expect(page.getByRole('button', { name: /First Tab Co/ })).toBeVisible()

    const otherTab = await page.context().newPage()
    await otherTab.goto('/login')
    await fillLoginForm(otherTab, other.email, other.password)
    await otherTab.getByRole('button', { name: 'Sign in' }).click()
    await expect(otherTab).toHaveURL(`/${theirs.url_key}/my-issues`)

    // The first tab now sends the new user's token (localStorage is shared): it
    // must not keep showing the first user's workspace, where every call fails.
    await expect(page).toHaveURL(`/${theirs.url_key}/my-issues`)
    await expect(page.getByRole('button', { name: /Other Tab Co/ })).toBeVisible()
    await expect(page.getByText('First Tab Co')).toHaveCount(0)
  })
})
