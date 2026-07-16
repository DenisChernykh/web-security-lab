import { useEffect, useState } from "react";
import { getCsrfAttackerOrigin } from "../lib/lab-api.js";

export function CsrfExercise() {
  const [attackerOrigin, setAttackerOrigin] = useState<string>();
  useEffect(() => { void getCsrfAttackerOrigin().then(({ origin }) => setAttackerOrigin(origin)); }, []);
  return (
    <section className="csrf-surface">
      <h2>Страница атакующего</h2>
      <p>Она может отправить форму, но Same-Origin Policy не позволяет прочитать ответ сайта-жертвы.</p>
      {attackerOrigin === undefined
        ? <p>Загружаем локальный attacker origin…</p>
        : <iframe title="CSRF attacker origin" src={`${attackerOrigin}/`} sandbox="allow-forms allow-scripts" />}
    </section>
  );
}
