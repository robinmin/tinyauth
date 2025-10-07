# Deploy Next.js with NextAuth to Cloudflare Workers

> **Important**: This guide uses `@opennextjs/cloudflare` which deploys to **Cloudflare Workers**, not Cloudflare Pages. Workers provide a serverless runtime environment that's ideal for Next.js applications with authentication.

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

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!
    })
  ],
  secret: process.env.NEXTAUTH_SECRET
});

export { handler as GET, handler as POST };
```

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
NEXTAUTH_SECRET="a_very_secure_random_string_generated_for_local_use"
NEXTAUTH_URL="http://localhost:8787"
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

## Step 6: Deploy to Cloudflare Workers

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

3.  **Create GitHub Actions workflow**: Create `.github/workflows/deploy.yml`:

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
npx wrangler secret put NEXTAUTH_SECRET
npx wrangler secret put NEXTAUTH_URL
```

For `NEXTAUTH_URL`, use your Worker URL (e.g., `https://tinyauth.<your-subdomain>.workers.dev`)

6.  **Update your OAuth Provider**: Go to your GitHub OAuth App settings and add the production callback URL:

- `https://tinyauth.<your-subdomain>.workers.dev/api/auth/callback/github`

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

## Appendix 2: Troubleshooting Common Issues

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

### Switching from Pages to Workers

**Problem**: You initially configured for Cloudflare Pages and need to switch.

**Solution**:
1. Update `wrangler.toml` to use Workers configuration (see Step 3)
2. Remove `pages_build_output_dir` from `wrangler.toml`
3. Use `wrangler secret put` instead of Pages secrets
4. Deploy using `npm run deploy` or GitHub Actions

---

## Additional Resources

- [OpenNext Cloudflare Documentation](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)

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
```
