const configuredAttackerOrigin = (): string => {
  const port = Number(window.location.port || "8080") + 1;
  return `http://${window.location.hostname || "localhost"}:${port}`;
};

export function CsrfExercise() {
  const attackerOrigin = configuredAttackerOrigin();
  return (
    <section className="csrf-surface">
      <h2>Страница атакующего</h2>
      <p>Она может отправить форму, но Same-Origin Policy не позволяет прочитать ответ сайта-жертвы.</p>
      <iframe title="CSRF attacker origin" src={`${attackerOrigin}/`} sandbox="allow-forms allow-scripts" />
    </section>
  );
}
