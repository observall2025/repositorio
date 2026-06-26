import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="page center-page">
      <section className="login-panel" aria-label="Login">
        <div className="brand-mark">
          <LockKeyhole size={22} aria-hidden="true" />
        </div>
        <h1 className="panel-title">Repositorio de documentos</h1>
        <p className="panel-copy">Entre para enviar arquivos e gerar links publicos.</p>

        {params?.error ? <p className="error">Email ou senha invalidos.</p> : null}

        <form action="/api/login" method="post">
          <label className="field">
            <span>Email</span>
            <input className="input" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="field">
            <span>Senha</span>
            <input className="input" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button" type="submit">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
