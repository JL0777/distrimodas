"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { ArrowRight, Loader2, LockKeyhole, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticate, type LoginState } from "@/actions/auth";

const initialState: LoginState = {};

export function LoginForm({ logoDisponible }: { logoDisponible: boolean }) {
  const [state, formAction, pending] = useActionState(authenticate, initialState);
  const [mostrarLogo, setMostrarLogo] = useState(logoDisponible);

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_35px_100px_-45px_rgba(75,32,58,0.35)] lg:min-h-[620px] lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#8d315c_0%,#6f284d_55%,#4d2747_100%)] p-10 text-white lg:flex xl:p-14">
        <div className="absolute -right-28 -top-24 size-80 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-12 size-64 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-white/[0.06]" />

        <div className="relative flex items-center gap-4">
          <div className="grid size-40 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <img src="/logo-distrimodas.png" alt="Distrimodas Logo" className="size-30 object-contain" />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-lg font-semibold tracking-wide leading-tight">DISTRIMODAS</p>
            <p className="text-xs tracking-[0.2em] text-white/65 leading-tight">LA SEXTA</p>
          </div>
        </div>

        <div className="relative max-w-md py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
            <Sparkles className="size-3.5" />
            Sistema de gestión comercial
          </div>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            Cada venta,
            <br />
            mejor organizada.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-white/75">
            Gestiona ventas, productos y equipos desde un solo lugar, de forma clara y sencilla.
          </p>
        </div>

        <p className="relative text-xs text-white/55">"Jehova es mi pastor y nada me faltara."</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <div className="relative mx-auto mb-5 grid size-24 place-items-center overflow-hidden rounded-[1.75rem] border border-rose-100 bg-rose-50 shadow-inner lg:mx-0">
              {mostrarLogo && (
                <Image
                  src="/logo-distrimodas.png"
                  alt="Logo de Distrimodas La Sexta"
                  width={96}
                  height={96}
                  className="absolute inset-0 z-10 h-full w-full object-contain p-2"
                  onError={() => setMostrarLogo(false)}
                />
              )}
              <ShoppingBag className="size-9 text-primary/75" />
            </div>
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Bienvenido</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Inicia sesión</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ingresa tus datos para continuar al sistema.
            </p>
          </div>

          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="Tu usuario"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <LockKeyhole className="size-4 text-muted-foreground" />
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                required
              />
            </div>

            {state?.error && (
              <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {state.error}
              </p>
            )}

            <Button type="submit" size="lg" className="h-12 w-full gap-2" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <>Ingresar <ArrowRight className="size-4" /></>}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
            Acceso exclusivo para el equipo de Distrimodas La Sexta.
          </p>
        </div>
      </section>
    </div>
  );
}
