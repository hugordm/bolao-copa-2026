This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Email de confirmação de cadastro (Supabase)

Por padrão, o Supabase envia o email de confirmação de cadastro em inglês. Para
traduzir para português:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) do projeto.
2. Vá em **Authentication → Email Templates → Confirm signup**.
3. Substitua o **Subject** por:

   ```
   Confirme seu email — Bolão da Copa 2026
   ```

4. Substitua o **Message body** por:

   ```html
   <h2>Confirme seu email</h2>
   <p>Olá! Clique no link abaixo para confirmar seu email e acessar o Bolão da Copa 2026.</p>
   <p><a href="{{ .ConfirmationURL }}">Confirmar email</a></p>
   ```

5. Clique em **Save**.

Mantenha a variável `{{ .ConfirmationURL }}` — é ela que o Supabase substitui
pelo link de confirmação real.

## Email de redefinição de senha (Supabase)

Por padrão, o Supabase envia o email de redefinição de senha em inglês. Para
traduzir para português:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) do projeto.
2. Vá em **Authentication → Email Templates → Reset password**.
3. Substitua o **Subject** por:

   ```
   Redefinir senha — Bolão da Copa 2026
   ```

4. Substitua o **Message body** por:

   ```html
   <h2>Redefinir senha</h2>
   <p>Olá! Clique no link abaixo para redefinir sua senha.</p>
   <p><a href="{{ .ConfirmationURL }}">Redefinir senha</a></p>
   <p>Se não foi você, ignore este email.</p>
   ```

5. Clique em **Save**.

Mantenha a variável `{{ .ConfirmationURL }}` — é ela que o Supabase substitui
pelo link de redefinição real.
