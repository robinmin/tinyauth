# Deploy Next.js with NextAuth to Cloudflare Workers

> **Important**: This guide uses `@opennextjs/cloudflare` which deploys to **Cloudflare Workers**, not Cloudflare Pages. Workers provide a serverless runtime environment that's ideal for Next.js applications with authentication.

## Quick Reference: OAuth Providers

This application supports multiple OAuth providers. You can use one or all of them:

| Provider | Required Secrets | Callback URL Pattern | Setup Guide |
|----------|------------------|----------------------|-------------|
| **GitHub** | `GITHUB_ID`, `GITHUB_SECRET` | `/api/auth/callback/github` | [Appendix 1](#appendix-1-getting-github-oauth-credentials) |
| **Google** | `GOOGLE_ID`, `GOOGLE_SECRET` | `/api/auth/callback/google` | [Appendix 2](#appendix-2-getting-google-oauth-credentials) |

**Required for all providers:**
- `NEXTAUTH_SECRET` - Random string for signing tokens (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Your application URL

---

## Step 1: Create Your Next.js Project

First, create a new Next.js application.

```bash
npx create-next-app@latest my-nextauth-app
cd my-nextauth-app
```

---

## Step 2: Add and Configure NextAuth.js

Next, add `next-auth` and set up the authentication API route.

1.  **Install the package**:

```bash
npm install next-auth
```

2.  **Create the API route**: Create a file at **`app/api/auth/[...nextauth]/route.ts`**. Configure it with your providers, pulling all secrets from `process.env`.

```typescript
// file: app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!
    })
  ],
  secret: process.env.NEXTAUTH_SECRET
});

export { handler as GET, handler as POST };
```

This example includes both GitHub and Google OAuth providers. You can use one or both depending on your needs.

---

## Step 3: Integrate the OpenNext Cloudflare Adapter

This step prepares your Next.js app for Cloudflare Workers using the correct OpenNext packages and commands.

1.  **Install the Cloudflare adapter for OpenNext**:

```bash
npm install @opennextjs/cloudflare@latest
```

2.  **Update your `package.json` scripts**: Modify the scripts to use the correct OpenNext Cloudflare commands.

```json
// file: package.json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "opennextjs-cloudflare build",
  "build-local": "next build",
  "deploy": "opennextjs-cloudflare deploy",
  "preview": "opennextjs-cloudflare preview",
  "start": "next start",
  "lint": "eslint"
},
```

3.  **Create `open-next.config.ts`**: This file configures OpenNext to avoid infinite build loops.

```typescript
// file: open-next.config.ts
import type { OpenNextConfig } from "@opennextjs/cloudflare/config";
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const config: OpenNextConfig = {
  ...defineCloudflareConfig({
    incrementalCache: r2IncrementalCache,
  }),
  buildCommand: "npm run build-local",
};

export default config;
```

4.  **Create `wrangler.toml`**: Configure Wrangler for Cloudflare Workers deployment.

```toml
# file: wrangler.toml
name = "tinyauth"
main = ".open-next/worker.js"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# R2 bucket for incremental cache (ISR)
[[r2_buckets]]
binding = "NEXT_INC_CACHE_R2_BUCKET"
bucket_name = "tinyauth-cache"

# Self-reference service binding for cache
[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "tinyauth"
```

5.  **Update `next.config.ts`**: Add output file tracing configuration.

```typescript
// file: next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
```

---

## Step 4: Manage Production Secrets with Wrangler

Securely store your production secrets in Cloudflare's infrastructure using Wrangler's simple, interactive commands.

1.  **Log in to Wrangler**:

```bash
npx wrangler login
```

2.  **Set your secrets one by one**: For Cloudflare Workers, use `wrangler secret put`. Wrangler will prompt you to securely paste in the value.

```bash
## set secrets for Workers
npx wrangler secret put GITHUB_ID
npx wrangler secret put GITHUB_SECRET
npx wrangler secret put GOOGLE_ID
npx wrangler secret put GOOGLE_SECRET
npx wrangler secret put NEXTAUTH_SECRET
npx wrangler secret put NEXTAUTH_URL
```

3.  **Verify secrets**: List all configured secrets.

```bash
npx wrangler secret list
```

---

## Step 5: Develop Locally

Use Wrangler to accurately simulate the Cloudflare Workers environment on your local machine.

1.  **Create a local secrets file**: Create a file named **`.dev.vars`** in your project root. Use quotes for all string values.

```toml
# file: .dev.vars

# Variables for local Cloudflare Workers simulation
GITHUB_ID="your_github_client_id"
GITHUB_SECRET="your_github_client_secret"
GOOGLE_ID="your_google_client_id"
GOOGLE_SECRET="your_google_client_secret"
NEXTAUTH_SECRET="a_very_secure_random_string_generated_for_local_use"
NEXTAUTH_URL="http://localhost:3000"
```

2.  **Add `.dev.vars` to `.gitignore`**: Ensure this file is never committed to your repository.

```.gitignore
.dev.vars
```

3.  **Run the local development server**:

- **Option A**: Use Next.js development server (faster, hot reload):
```bash
npm run dev
```

  This runs at **`http://localhost:3000`** with Turbopack for fast refresh.

- **Option B**: Preview the production Worker build locally:
```bash
npm run build
npm run preview
```

  This simulates the actual Cloudflare Workers environment at **`http://localhost:8787`**.

---

## Step 6: Create R2 Bucket for Caching

Before deploying, you need to create an R2 bucket for incremental static regeneration (ISR) caching.

1.  **Log in to Wrangler** (if not already logged in):

```bash
npx wrangler login
```

2.  **Create the R2 bucket**:

```bash
npx wrangler r2 bucket create tinyauth-cache
```

This creates a bucket named `tinyauth-cache` that matches the configuration in `wrangler.toml`.

3.  **Verify the bucket was created**:

```bash
npx wrangler r2 bucket list
```

You should see `tinyauth-cache` in the list.

---

## Step 7: Deploy to Cloudflare Workers

You have two options for deploying to Cloudflare Workers: manual deployment or automated deployment via GitHub Actions.

### Option A: Manual Deployment from Local Machine

1.  **Build your application**:

```bash
npm run build
```

2.  **Deploy to Cloudflare Workers**:

```bash
npm run deploy
```

3.  **Update your OAuth Provider**: Go to your GitHub OAuth App settings and add the production callback URL:

- `https://tinyauth.<your-subdomain>.workers.dev/api/auth/callback/github`

Your application is now live! 🎉

### Option B: Automated Deployment via GitHub Actions (Recommended)

1.  **Create a Cloudflare API Token**:

- Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **My Profile** → **API Tokens**
- Click **Create Token**
- Use the **Edit Cloudflare Workers** template
- Copy the generated token

2.  **Add the token to GitHub Secrets**:

- Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
- Click **New repository secret**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: Paste your Cloudflare API token
- Click **Add secret**

or you can use the following command to add the secret:
```bash
gh secret set CLOUDFLARE_API_TOKEN -b "$(cat ~/.cloudflare/api-token)"
```

3.  **Create the R2 bucket** (one-time setup):

```bash
npx wrangler r2 bucket create tinyauth-cache
```

4.  **Create GitHub Actions workflow**: Create `.github/workflows/deploy.yml`:

```yaml
# file: .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

4.  **Push your code**: Commit and push to GitHub:

```bash
git add .
git commit -m "Add GitHub Actions deployment"
git push origin main
```

5.  **Set Production Environment Variables**: After the first deployment, set your secrets using Wrangler:

```bash
npx wrangler secret put GITHUB_ID
npx wrangler secret put GITHUB_SECRET
npx wrangler secret put GOOGLE_ID
npx wrangler secret put GOOGLE_SECRET
npx wrangler secret put NEXTAUTH_SECRET
npx wrangler secret put NEXTAUTH_URL
```

For `NEXTAUTH_URL`, use your Worker URL (e.g., `https://tinyauth.<your-subdomain>.workers.dev`)

6.  **Update your OAuth Providers**:

   **GitHub**: Go to your GitHub OAuth App settings and add the production callback URL:
   - `https://tinyauth.<your-subdomain>.workers.dev/api/auth/callback/github`

   **Google**: In Google Cloud Console, add to **Authorized redirect URIs**:
   - `https://tinyauth.<your-subdomain>.workers.dev/api/auth/callback/google`

Now, any push to your main branch will automatically trigger a new deployment! 🎉

### Using a Custom Domain (Optional)

To use a custom domain instead of `*.workers.dev`:

1.  In the Cloudflare dashboard, go to **Workers & Pages** → **Your Worker** → **Settings** → **Triggers**
2.  Click **Add Custom Domain**
3.  Enter your domain (must be managed by Cloudflare)
4.  Update `NEXTAUTH_URL` secret to use your custom domain
5.  Update your OAuth provider callback URL accordingly

---

## Appendix 1: Getting GitHub OAuth Credentials

To use GitHub for authentication, you need to register an OAuth application on github.com to get a **Client ID** and **Client Secret**.

1.  **Navigate to Developer Settings**

- Log in to your GitHub account.
- Click on your profile picture in the top-right corner and select **Settings**.
- In the left sidebar, scroll down and click on **Developer settings**.

2.  **Register a New OAuth Application**

- Click on **OAuth Apps**, then click the **New OAuth App** button.
- Fill out the registration form:
  - **Application name**: Something descriptive, like `My Cloudflare App`.
  - **Homepage URL**: The main URL of your application. For development, you can use `http://localhost:3000`. For production, use your Cloudflare Worker URL (`https://tinyauth.<your-subdomain>.workers.dev`).
  - **Authorization callback URL**: This is the most important field. NextAuth.js uses a specific URL format. You should add one for development and one for production.
    - **Development**: `http://localhost:3000/api/auth/callback/github`
    - **Production**: `https://tinyauth.<your-subdomain>.workers.dev/api/auth/callback/github`

3.  **Generate and Copy Your Credentials**

- After clicking **Register application**, you'll be taken to your new app's page.
- The **Client ID** (this is your `GITHUB_ID`) will be visible on the page.
- Click the **Generate a new client secret** button.
- **Important**: Copy your new **Client Secret** (`GITHUB_SECRET`) immediately. **You will not be able to see this value again after you leave the page.**

You now have the `GITHUB_ID` and `GITHUB_SECRET` values needed for your `.dev.vars` file and your Wrangler secrets.

---

## Appendix 2: Getting Google OAuth Credentials

To use Google for authentication, you need to create OAuth credentials in Google Cloud Console.

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter a project name (e.g., "TinyAuth")
4. Click **Create**

### 2. Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type and click **Create**
3. Fill in the required information:
   - **App name**: TinyAuth (or your app name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**
5. On the **Scopes** page, click **Save and Continue** (default scopes are fine)
6. On the **Test users** page, add your email for testing, then click **Save and Continue**
7. Review and click **Back to Dashboard**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: **Web application**
4. Enter a name: "TinyAuth Web Client"
5. **Authorized JavaScript origins** (optional):
   - Add `http://localhost:3000` (for development)
   - Add `https://tinyauth.<your-subdomain>.workers.dev` (for production)
6. **Authorized redirect URIs** (required):
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://tinyauth.<your-subdomain>.workers.dev/api/auth/callback/google`
7. Click **Create**

### 4. Copy Your Credentials

After creating the OAuth client:

1. A dialog will show your **Client ID** and **Client secret**
2. Copy the **Client ID** (this is your `GOOGLE_ID`)
3. Copy the **Client secret** (this is your `GOOGLE_SECRET`)
4. You can always access these later from the **Credentials** page

**Important**: Keep your client secret secure. If it's ever compromised, you can regenerate it from the Credentials page.

### 5. Add Credentials to Your Application

**For local development**, add to `.dev.vars`:
```toml
GOOGLE_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_SECRET="your_google_client_secret"
```

**For production**, use Wrangler:
```bash
npx wrangler secret put GOOGLE_ID
npx wrangler secret put GOOGLE_SECRET
```

### 6. Publishing Your App (Optional)

If you want to move from testing to production:

1. Go to **OAuth consent screen**
2. Click **Publish App**
3. Follow the verification process if you need more than 100 users

For most internal or small applications, staying in "Testing" mode is sufficient.

---

## Appendix 3: Troubleshooting Common Issues

### Infinite Build Loop

**Problem**: Running `npm run build` causes an infinite loop.

**Solution**: Ensure `open-next.config.ts` has the correct `buildCommand`:

```typescript
const config: OpenNextConfig = {
  ...defineCloudflareConfig({
    incrementalCache: r2IncrementalCache,
  }),
  buildCommand: "npm run build-local",  // This prevents the loop
};
```

### Worker Size Exceeds Limits

**Problem**: Deployment fails with "Worker exceeds size limit".

**Limits**:
- Free plan: 3 MiB
- Paid plan: 10 MiB

**Solutions**:
- Analyze your bundle: Use `next-bundle-analyzer`
- Remove unused dependencies
- Use dynamic imports for large libraries
- Consider upgrading to a paid plan

### Module Not Found Errors

**Problem**: Errors like "Cannot find module" or "Uncaught ReferenceError".

**Solution**: Ensure `wrangler.toml` has the correct configuration:

```toml
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]
```

### `.open-next` Directory Not Found in Deployment

**Problem**: Build works locally but fails in CI/CD.

**Solution**: Never commit `.open-next/` to git. It's a build artifact that should be in `.gitignore`:

```gitignore
.open-next/
```

The directory will be generated fresh during each build.

### Authentication Callback Errors

**Problem**: OAuth callback fails with 404 or redirect errors.

**Solutions**:
1. Verify your `NEXTAUTH_URL` matches your actual deployment URL
2. Check that your OAuth provider callback URL is correctly configured
3. Ensure `NEXTAUTH_SECRET` is set in production
4. For local development, use `http://localhost:3000`, not `http://localhost:8787`

### Environment Variables Not Working

**Problem**: Environment variables are undefined in the Worker.

**Solution**: For Cloudflare Workers, use `wrangler secret put` for sensitive values:

```bash
npx wrangler secret put GITHUB_ID
npx wrangler secret put GITHUB_SECRET
npx wrangler secret put NEXTAUTH_SECRET
npx wrangler secret put NEXTAUTH_URL
```

For non-sensitive values, add them to `wrangler.toml`:

```toml
[vars]
PUBLIC_API_URL = "https://api.example.com"
```

### R2 Bucket Binding Error

**Problem**: Deployment fails with "No R2 binding 'NEXT_INC_CACHE_R2_BUCKET' found!"

**Solution**: Create the R2 bucket and ensure `wrangler.toml` is configured correctly.

1. **Create the R2 bucket**:
   ```bash
   npx wrangler r2 bucket create tinyauth-cache
   ```

2. **Verify `wrangler.toml` has the correct configuration**:
   ```toml
   [[r2_buckets]]
   binding = "NEXT_INC_CACHE_R2_BUCKET"
   bucket_name = "tinyauth-cache"

   [[services]]
   binding = "WORKER_SELF_REFERENCE"
   service = "tinyauth"
   ```

3. **Verify the bucket exists**:
   ```bash
   npx wrangler r2 bucket list
   ```

4. **Alternative: Use dummy cache for testing** (not recommended for production):

   Update `open-next.config.ts`:
   ```typescript
   export default defineCloudflareConfig({
     incrementalCache: "dummy",  // Disables caching
   });
   ```

### Switching from Pages to Workers

**Problem**: You initially configured for Cloudflare Pages and need to switch.

**Solution**:
1. Update `wrangler.toml` to use Workers configuration (see Step 3)
2. Remove `pages_build_output_dir` from `wrangler.toml`
3. Add R2 bucket binding (see above)
4. Use `wrangler secret put` instead of Pages secrets
5. Deploy using `npm run deploy` or GitHub Actions

---

## Additional Resources

- [OpenNext Cloudflare Documentation](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)

---

## Appendix 3: Testing and Verifying Your Worker

### Testing Locally

Before deploying, test your Worker locally to ensure it's working correctly.

1. **Build and preview**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Test with curl**:
   ```bash
   # Test the homepage
   curl http://localhost:8787

   # Test with headers
   curl -I http://localhost:8787

   # Test the API route
   curl http://localhost:8787/api/auth/providers

   # Test with verbose output
   curl -v http://localhost:8787
   ```

3. **Test in browser**:
   - Open `http://localhost:8787` in your browser
   - Check the Network tab in DevTools to see requests/responses
   - Verify static assets are loading correctly

### Testing Production Deployment

After deploying to Cloudflare Workers, verify it's working correctly:

1. **Basic connectivity test**:
   ```bash
   # Replace with your actual Worker URL
   curl https://tinyauth.<your-subdomain>.workers.dev

   # Get response headers
   curl -I https://tinyauth.<your-subdomain>.workers.dev

   # Check for redirects
   curl -L https://tinyauth.<your-subdomain>.workers.dev
   ```

2. **Test specific routes**:
   ```bash
   # Test NextAuth providers endpoint
   curl https://tinyauth.<your-subdomain>.workers.dev/api/auth/providers

   # Expected response: {"github":{...},"google":{...}}
   # Should show both GitHub and Google providers
   ```

3. **Test with different methods**:
   ```bash
   # POST request
   curl -X POST https://tinyauth.<your-subdomain>.workers.dev/api/auth/signin

   # With JSON data
   curl -X POST https://tinyauth.<your-subdomain>.workers.dev/api/auth/callback/credentials \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```

4. **Check response times**:
   ```bash
   # Measure response time
   curl -w "\nTime: %{time_total}s\n" https://tinyauth.<your-subdomain>.workers.dev

   # Multiple requests to check cold start vs warm
   for i in {1..5}; do
     curl -w "Request $i: %{time_total}s\n" -o /dev/null -s https://tinyauth.<your-subdomain>.workers.dev
   done
   ```

### Using HTTPie (Alternative to curl)

If you prefer a more user-friendly tool, install [HTTPie](https://httpie.io/):

```bash
# Install HTTPie
brew install httpie  # macOS
# or
pip install httpie  # Python

# Test your Worker
http https://tinyauth.<your-subdomain>.workers.dev

# Test with headers
http https://tinyauth.<your-subdomain>.workers.dev User-Agent:TestBot

# Pretty print JSON response
http https://tinyauth.<your-subdomain>.workers.dev/api/auth/providers
```

### Monitoring and Debugging

1. **View live logs**:
   ```bash
   # Stream Worker logs in real-time
   npx wrangler tail

   # Filter logs
   npx wrangler tail --status error

   # Show specific number of logs
   npx wrangler tail --format pretty
   ```

2. **Check Worker status**:
   ```bash
   # List all Workers
   npx wrangler list

   # Get Worker details
   npx wrangler deployments list
   ```

3. **Test from different locations**:
   ```bash
   # Use a service to test from multiple locations
   # Example with curl from different IPs (using a VPN or proxy)
   curl --interface <your-vpn-interface> https://tinyauth.<your-subdomain>.workers.dev
   ```

### Common Test Scenarios

```bash
# 1. Verify SSL/TLS is working
curl -v https://tinyauth.<your-subdomain>.workers.dev 2>&1 | grep -i ssl

# 2. Check if CORS headers are set (if needed)
curl -I -X OPTIONS https://tinyauth.<your-subdomain>.workers.dev \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET"

# 3. Test error handling
curl https://tinyauth.<your-subdomain>.workers.dev/nonexistent-page

# 4. Verify static assets
curl -I https://tinyauth.<your-subdomain>.workers.dev/favicon.ico

# 5. Test OAuth flow (redirects)
curl -L https://tinyauth.<your-subdomain>.workers.dev/api/auth/signin/github

# 6. Check response compression
curl -H "Accept-Encoding: gzip" -I https://tinyauth.<your-subdomain>.workers.dev
```

### Automated Health Checks

Create a simple health check script:

```bash
#!/bin/bash
# save as check-worker.sh

WORKER_URL="https://tinyauth.<your-subdomain>.workers.dev"

echo "Checking Worker health..."

# Check if Worker is responding
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $WORKER_URL)

if [ $STATUS -eq 200 ]; then
  echo "✅ Worker is UP (HTTP $STATUS)"
else
  echo "❌ Worker is DOWN or ERROR (HTTP $STATUS)"
  exit 1
fi

# Check response time
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null $WORKER_URL)
echo "⏱️  Response time: ${RESPONSE_TIME}s"

# Check if NextAuth is configured
PROVIDERS=$(curl -s "$WORKER_URL/api/auth/providers")
if echo "$PROVIDERS" | grep -q "github"; then
  echo "✅ NextAuth GitHub provider configured"
else
  echo "⚠️  GitHub provider not found"
fi

if echo "$PROVIDERS" | grep -q "google"; then
  echo "✅ NextAuth Google provider configured"
else
  echo "⚠️  Google provider not found"
fi

echo "Health check complete!"
```

Make it executable and run:
```bash
chmod +x check-worker.sh
./check-worker.sh
```

### Troubleshooting Connection Issues

If curl tests fail:

1. **DNS propagation**: Wait a few minutes after deployment for DNS to propagate
   ```bash
   # Check DNS resolution
   nslookup tinyauth.<your-subdomain>.workers.dev
   dig tinyauth.<your-subdomain>.workers.dev
   ```

2. **Certificate issues**: Ensure SSL/TLS is working
   ```bash
   # Test SSL certificate
   openssl s_client -connect tinyauth.<your-subdomain>.workers.dev:443 -servername tinyauth.<your-subdomain>.workers.dev
   ```

3. **Worker errors**: Check Wrangler logs
   ```bash
   npx wrangler tail --status error
   ```

4. **Network restrictions**: Try from different networks/locations
   ```bash
   # Use a different DNS resolver
   curl --dns-servers 8.8.8.8 https://tinyauth.<your-subdomain>.workers.dev
   ```

---

## Summary of Key Commands

```bash
# Development
npm run dev              # Next.js dev server (localhost:3000)
npm run build-local      # Build Next.js only
npm run build            # Full OpenNext build for Workers
npm run preview          # Preview Worker locally (localhost:8787)

# Deployment
npm run deploy           # Deploy to Cloudflare Workers
npx wrangler login       # Authenticate with Cloudflare
npx wrangler secret put  # Set production secrets
npx wrangler secret list # List configured secrets
npx wrangler tail        # View live Worker logs

# Testing
curl http://localhost:8787                                    # Test local Worker
curl https://tinyauth.<your-subdomain>.workers.dev           # Test production
curl https://tinyauth.<your-subdomain>.workers.dev/api/auth/providers  # Test NextAuth
npx wrangler tail        # Monitor real-time logs
npx wrangler deployments list  # Check deployment history
```
