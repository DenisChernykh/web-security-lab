import { useEffect, useState } from "react";
import { FIXED_EXERCISES, type LabMode } from "@local-lab/contracts";
import { csrfLogin, getCsrfAttackerOrigin, getCsrfForm, getCsrfProfile, submitLegitimateCsrfChange } from "../lib/lab-api.js";

export function CsrfExercise({ mode }: { mode: LabMode }) {
  const [attackerOrigin, setAttackerOrigin] = useState<string>();
  const [profile, setProfile] = useState<string>();
  const [status, setStatus] = useState<string>();
  useEffect(() => { void getCsrfAttackerOrigin().then(({ origin }) => setAttackerOrigin(origin)); }, []);
  const refresh = async () => setProfile((await getCsrfProfile()).profile.email);
  const legitimate = async () => {
    await csrfLogin();
    const { csrfToken } = await getCsrfForm();
    const result = await submitLegitimateCsrfChange(FIXED_EXERCISES.csrf.normalEmail, csrfToken);
    setStatus(result.outcome === "expected" ? "Легитимная форма принята" : result.outcome);
    await refresh();
  };
  const openAttack = async () => {
    await csrfLogin();
    window.open(attackerOrigin, "csrf-attacker");
    setStatus("Attacker origin открыт: отправьте форму там, затем проверьте профиль. Ответ атаки ему недоступен из-за SOP.");
  };
  return (
    <section className="csrf-surface">
      <h2>Страница атакующего</h2>
      <p>Она может отправить форму, но Same-Origin Policy не позволяет прочитать ответ сайта-жертвы.</p>
      {attackerOrigin === undefined
        ? <p>Загружаем локальный attacker origin…</p>
        : <iframe title="CSRF attacker origin" src={`${attackerOrigin}/`} sandbox="allow-forms allow-scripts" />}
      <div className="csrf-actions">
        <button type="button" onClick={() => void legitimate()}>Отправить легитимную форму с токеном</button>
        <button type="button" disabled={attackerOrigin === undefined} onClick={() => void openAttack()}>Открыть межсайтовую атаку</button>
        <button type="button" onClick={() => void refresh()}>Проверить профиль после атаки</button>
      </div>
      <p>Режим жертвы: <strong>{mode === "safe" ? "защищённый" : "уязвимый"}</strong></p>
      {profile === undefined ? null : <p>Текущий email: <code>{profile}</code></p>}
      {status === undefined ? null : <p role="status">{status}</p>}
    </section>
  );
}
