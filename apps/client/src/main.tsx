import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { TableSummary } from "@friendly-holdem/shared";
import "./styles.css";

const demoTable: TableSummary = {
  tableId: "invite-preview",
  viewerRole: "host",
  seatedPlayerCount: 0,
  spectatorCount: 0,
  defaults: {
    startingStack: 1000,
    blinds: {
      smallBlind: 5,
      bigBlind: 10
    },
    disconnectedActionGraceMs: 30000,
    hostAutoFoldAfterMs: 120000,
    eventLogCap: 200
  }
};

function App() {
  return (
    <main className="app-shell">
      <section className="table-room" aria-labelledby="table-heading">
        <div className="table-room__status">Private table foundation</div>
        <h1 id="table-heading">Friendly Hold'em</h1>
        <p>
          A quiet tabletop room is ready for the next slices: private invites, player snapshots,
          host controls, and one complete hand of play-money Hold'em.
        </p>

        <dl className="table-room__defaults" aria-label="Default table settings">
          <div>
            <dt>Starting stack</dt>
            <dd>${demoTable.defaults.startingStack.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Blinds</dt>
            <dd>
              ${demoTable.defaults.blinds.smallBlind}/${demoTable.defaults.blinds.bigBlind}
            </dd>
          </div>
          <div>
            <dt>Event log cap</dt>
            <dd>{demoTable.defaults.eventLogCap}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
