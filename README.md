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

## Panel semanal del socio

En bases de datos existentes, aplica una sola vez `database/migrations/20261021_jose_partner_role.sql` antes de desplegar la nueva versión. Para crear la cuenta de acceso, ejecuta `npm run provision:jose` desde una terminal interactiva; solicitará la contraseña sin mostrarla ni guardarla en el código y pedirá confirmar el host de destino.

Para aprovisionar en Aiven desde PowerShell, configura temporalmente `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` y `DB_SSL_CA` con los datos de Aiven y la ruta local al certificado CA descargado desde el servicio. El script solicitará de forma oculta la contraseña de MySQL de Aiven. Confirma el host mostrado antes de continuar. Estas variables solo afectan esa terminal; al cerrarla, `.env.local` sigue intacto.

El usuario `jose` puede consultar las ventas de gorras/sombreros, pavas y guantes (excepto guantes de cocina) de ambas sedes, en la semana actual y en el historial semanal.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
