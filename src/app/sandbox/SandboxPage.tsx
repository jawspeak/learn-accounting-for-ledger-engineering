/** Phase-0 placeholder. SBX (phase 2) builds the Scenario Board. */
export function SandboxPage({ data }: { data?: string }) {
  return (
    <article>
      <h1>Sandbox</h1>
      <p>Coming in phase 2.{data ? ' (State found in URL.)' : ''}</p>
    </article>
  );
}
