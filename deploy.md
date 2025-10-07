## Step 1: Create Your Next.js Project

First, create a new Next.js application.

```bash
npx create-next-app@latest my-nextauth-app
cd my-nextauth-app
```

-----

## Step 2: Add and Configure NextAuth.js

Next, add `next-auth` and set up the authentication API route.

1.  **Install the package**:

    ```bash
    npm install next-auth
    ```

2.  **Create the API route**: Create a file at **`app/api/auth/[...nextauth]/route.ts`**. Configure it with your providers, pulling all secrets from `process.env`.

    ```typescript
    // file: app/api/auth/[...nextauth]/route.ts

    import NextAuth from 'next-auth';
    import GithubProvider from 'next-auth/providers/github';

    const handler = NextAuth({
      providers: [
        GithubProvider({
          clientId: process.env.GITHUB_ID!,
          clientSecret: process.env.GITHUB_SECRET!,
        }),
      ],
      secret: process.env.NEXTAUTH_SECRET,
    });

    export { handler as GET, handler as POST };
    ```

-----

## Step 3: Integrate the OpenNext Adapter

This step prepares your Next.js app for Cloudflare using the correct OpenNext packages and commands.

1.  **Install OpenNext and the Cloudflare adapter**:

    ```bash
    npm install opennext @opennextjs/cloudflare@latest
    ```

2.  **Update your `package.json` scripts**: Modify the `build` script to use the correct `open-next` command.

    ```json
    // file: package.json
    "scripts": {
      "dev": "next dev",
      "build": "open-next build",
      "start": "next start",
      "lint": "next lint"
    },
    ```

-----

## Step 4: Manage Production Secrets with Wrangler

Securely store your production secrets in Cloudflare's infrastructure using Wrangler's simple, interactive commands.

1.  **Log in to Wrangler**:

    ```bash
    npx wrangler login
    ```

2.  **Set your secrets one by one**: Run the command for each secret. Wrangler will prompt you to securely paste in the value.

    ```bash
    npx wrangler secret put GITHUB_ID
    npx wrangler secret put GITHUB_SECRET
    npx wrangler secret put NEXTAUTH_SECRET
    ```

-----

## Step 5: Develop Locally

Use Wrangler to accurately simulate the Cloudflare environment on your local machine.

1.  **Create a local secrets file**: Create a file named **`.dev.vars`** in your project root. Use quotes for all string values.

    ```toml
    # file: .dev.vars

    # Variables for local Cloudflare simulation with `wrangler pages dev`
    GITHUB_ID="your_github_client_id"
    GITHUB_SECRET="your_github_client_secret"
    NEXTAUTH_SECRET="a_very_secure_random_string_generated_for_local_use"
    ```

2.  **Add `.dev.vars` to `.gitignore`**: Ensure this file is never committed to your repository.

    ```.gitignore
    .dev.vars
    ```

3.  **Run the local development server**:

      * First, build the project with OpenNext:
        ```bash
        npm run build
        ```
      * Then, start the Wrangler development server:
        ```bash
        npx wrangler pages dev .open-next/server-function
        ```

    You can now test your full application at **`http://localhost:8788`**.

-----

## Step 6: Deploy to Cloudflare Pages

Finally, connect your GitHub repository to Cloudflare for automated deployments.

1.  **Push your code**: Initialize a git repository, commit your files, and push them to a new repository on GitHub.

2.  **Connect to Cloudflare Pages**:

      * In the Cloudflare dashboard, go to **Workers & Pages** and **Create a project**.
      * Select **Connect to Git** and choose your GitHub repository.

3.  **Configure Build Settings**: Use the following configuration:

      * **Build command**: `npm run build`
      * **Build output directory**: `.open-next/server-function`

4.  **Set Production Environment Variables**: Go to your new project's **Settings** -\> **Environment variables**. Your secrets are already handled by Wrangler, but you **must** add the `NEXTAUTH_URL`.

      * **Variable name**: `NEXTAUTH_URL`
      * **Value**: Your final production URL (e.g., `https://your-app-name.pages.dev`)

5.  **Update your OAuth Provider**: Go to your GitHub OAuth App settings and add the production callback URL:

      * `https://your-app-name.pages.dev/api/auth/callback/github`

Click **Save and Deploy**. Your application is now live, and any future push to your main branch will automatically trigger a new deployment. 🎉

-----

## Appendix 1: Getting GitHub OAuth Credentials

To use GitHub for authentication, you need to register an OAuth application on github.com to get a **Client ID** and **Client Secret**.

1.  **Navigate to Developer Settings**

      * Log in to your GitHub account.
      * Click on your profile picture in the top-right corner and select **Settings**.
      * In the left sidebar, scroll down and click on **Developer settings**.

2.  **Register a New OAuth Application**

      * Click on **OAuth Apps**, then click the **New OAuth App** button.
      * Fill out the registration form:
          * **Application name**: Something descriptive, like `My Cloudflare App`.
          * **Homepage URL**: The main URL of your application. For development, you can use your Wrangler URL (`http://localhost:8788`). For production, use your final Cloudflare Pages URL (`https://your-app-name.pages.dev`).
          * **Authorization callback URL**: This is the most important field. NextAuth.js uses a specific URL format. You should add one for development and one for production.
              * **Development**: `http://localhost:8788/api/auth/callback/github`
              * **Production**: `https://your-app-name.pages.dev/api/auth/callback/github`

3.  **Generate and Copy Your Credentials**

      * After clicking **Register application**, you'll be taken to your new app's page.
      * The **Client ID** (this is your `GITHUB_ID`) will be visible on the page.
      * Click the **Generate a new client secret** button.
      * **Important**: Copy your new **Client Secret** (`GITHUB_SECRET`) immediately. **You will not be able to see this value again after you leave the page.**

You now have the `GITHUB_ID` and `GITHUB_SECRET` values needed for your `.dev.vars` file and your Wrangler secrets.
