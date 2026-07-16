import { useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import { FIXED_EXERCISES, type LabMode } from "@local-lab/contracts";
import { csrfLogin, getCsrfAttackerOrigin, getCsrfForm, getCsrfProfile, submitLegitimateCsrfChange } from "../lib/lab-api.js";
import type { ExperimentAction, ExperimentState, RequestKind } from "../lib/experiment-reducer.js";

interface CsrfExerciseProps {
  mode: LabMode;
  state: ExperimentState;
  dispatch: Dispatch<ExperimentAction>;
}

const canStart = (state: ExperimentState): boolean =>
  (state.status === "ready" || state.status === "complete" || state.status === "stream-incomplete") &&
  state.modeChangePending === undefined;

export function CsrfExercise({ mode, state, dispatch }: CsrfExerciseProps) {
  const [attackerOrigin, setAttackerOrigin] = useState<string>();
  const [profile, setProfile] = useState<string>();
  const [status, setStatus] = useState<string>();
  const pendingBaselineTraceId = useRef<string | undefined>(undefined);
  useEffect(() => {
    void getCsrfAttackerOrigin()
      .then(({ origin }) => {
        const url = new URL(origin);
        url.hostname = window.location.hostname;
        setAttackerOrigin(url.origin);
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Attacker origin недоступен"));
  }, []);

  const start = (requestKind: RequestKind): boolean => {
    if (!canStart(state)) return false;
    dispatch({ type: "REQUEST_KIND_CHANGED", requestKind });
    dispatch({ type: "RUN_STARTED" });
    return true;
  };

  const refresh = async () => {
    try {
      const result = await getCsrfProfile();
      setProfile(result.profile.email);
      if (state.status === "running" && result.lastResult !== undefined && result.lastResult.traceId !== pendingBaselineTraceId.current) {
        pendingBaselineTraceId.current = result.lastResult.traceId;
        dispatch({ type: "RUN_SUCCEEDED", result: result.lastResult });
      } else if (state.status === "running") {
        setStatus("Сначала отправьте фиксированную форму в окне атакующего.");
      }
    } catch (error) {
      if (state.status === "running") {
        dispatch({ type: "RUN_FAILED", error: error instanceof Error ? error.message : "Profile unavailable" });
      }
      setStatus(error instanceof Error ? error.message : "Profile unavailable");
    }
  };

  const legitimate = async () => {
    if (!start("normal")) return;
    try {
      await csrfLogin();
      const { csrfToken } = await getCsrfForm();
      const result = await submitLegitimateCsrfChange(FIXED_EXERCISES.csrf.normalEmail, csrfToken);
      setProfile((result.body as { profile: { email: string } }).profile.email);
      pendingBaselineTraceId.current = result.traceId;
      setStatus("Легитимная форма принята");
      dispatch({ type: "RUN_SUCCEEDED", result });
    } catch (error) {
      dispatch({ type: "RUN_FAILED", error: error instanceof Error ? error.message : "Legitimate request failed" });
    }
  };

  const openAttack = async () => {
    const popup = window.open("", "csrf-attacker");
    if (popup === null || attackerOrigin === undefined) {
      setStatus("Браузер заблокировал учебное окно атакующего.");
      return;
    }
    if (!start("attack")) {
      popup.close();
      return;
    }
    try {
      await csrfLogin();
      const baseline = await getCsrfProfile();
      pendingBaselineTraceId.current = baseline.lastResult?.traceId;
      setProfile(baseline.profile.email);
      popup.location.href = attackerOrigin;
      setStatus("Attacker origin открыт: отправьте форму там, затем проверьте профиль. Ответ атаки ему недоступен из-за SOP.");
    } catch (error) {
      popup.close();
      const message = error instanceof Error ? error.message : "Не удалось открыть учебную атаку";
      setStatus(message);
      dispatch({ type: "RUN_FAILED", error: message });
    }
  };
  return (
    <section className="csrf-surface">
      <h2>Страница атакующего</h2>
      <p>Она может отправить форму, но Same-Origin Policy не позволяет прочитать ответ сайта-жертвы.</p>
      {attackerOrigin === undefined
        ? <p>Загружаем локальный attacker origin…</p>
        : <p>Фиксированный attacker origin: <code>{attackerOrigin}</code></p>}
      <div className="csrf-actions">
        <button type="button" disabled={!canStart(state)} onClick={() => void legitimate()}>Отправить легитимную форму с токеном</button>
        <button type="button" disabled={attackerOrigin === undefined || !canStart(state)} onClick={() => void openAttack()}>Открыть межсайтовую атаку</button>
        <button type="button" onClick={() => void refresh()}>Проверить профиль после атаки</button>
      </div>
      <p>Режим жертвы: <strong>{mode === "safe" ? "защищённый" : "уязвимый"}</strong></p>
      {profile === undefined ? null : <p>Текущий email: <code>{profile}</code></p>}
      {status === undefined ? null : <p role="status">{status}</p>}
    </section>
  );
}
