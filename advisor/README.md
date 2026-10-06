# furlong-advisor

An AI advisor for **Furlong**, a medieval kingdom simulation. It is a small MCP server (stdio, no dependencies)
that lets the agent app of your choice, on any model, see the game you have open in your browser, answer for its
rules, and suggest how to play. When you rule, it speaks as your closest confidant at court; otherwise it is the
game master. It changes the game only when you ask, and keeps quiet when you tell it to.

## Use

The easy way: in the game, click 🗣 and copy the prompt into your agent app (Claude Code, Claude Cowork, Cursor,
or any app that can run local MCP servers). It sets itself up.

By hand, register it as a local MCP server:

- **Claude Code:** `claude mcp add furlong -- npx -y furlong-advisor`
- **Claude Desktop / Cursor / others:**
  ```json
  { "mcpServers": { "furlong": { "command": "npx", "args": ["-y", "furlong-advisor"] } } }
  ```

Then ask the agent anything about your realm: it answers with a pairing code (five letters and a digit). Enter it in the game's
Advisor dialog (Menu → Advisor) and press Connect. Needs Node 18 or later.

## Tools

- `search` finds controls, places, houses, people, and the paragraph of the rules (the game's README and its guide
  to the screen) that answers a question.
- `discover` lists what can be done: every button, slider and list the game has, read off the live page (closed
  panels too), each named by what it does (`crown:h-honour:3`) with its cost, why it is disabled, target and risk,
  plus verbs to read the state, panels, cards and annals, find things, pick on the map, plan works, and name the
  advisor's persona.
- `execute` uses one and answers with the game's reply and the annals it wrote.

The bridge listens on 127.0.0.1 only (port 7357; `FURLONG_PORT` to change it) and accepts only a game that
gives the pairing code.
