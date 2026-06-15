# Friendly Hold'em

This context defines the shared language for Friendly Hold'em, a private-link, play-money Texas Hold 'em web app.

## Language

**Active Table Persistence**:
The ability for an active **Table**, including an in-progress **Hand**, to survive a server restart and remain recoverable by its private invite link and participant session tokens.
_Avoid_: Game persistence, persistence layer

**Table**:
A private game room created by a **Host** for one continuous play session across one or more **Hands**.

**Hand**:
One deal of Texas Hold 'em played within a **Table**.

**Session Token**:
A private browser-held token that identifies a returning participant at a **Table**.

## Relationships

- A **Table** contains zero or one active **Hand**.
- A **Table** has exactly one **Host**.
- A **Session Token** belongs to exactly one participant within a **Table**.
- **Active Table Persistence** preserves a **Table**, its current **Hand**, and its participant **Session Tokens** across a server restart.
- **Active Table Persistence** does not preserve live socket connections; participants reconnect to a restored **Table** with their **Session Tokens**.

## Example Dialogue

> **Dev:** "Should active table persistence bring players back to the same hand after a deploy?"
> **Domain expert:** "Yes, the table should recover from the private invite link, and each browser should reconnect with its session token."

## Flagged Ambiguities

- "game persistence" was used to mean **Active Table Persistence**; resolved: **Table** is the top-level concept, and a **Hand** is nested inside it.
