# Match Detail UI Improvements

_Started 2026-05-07 00:28 UTC_

---

## User

Me gustaria que me propusieses recomendaciones para mejor la UI/UX. Hay algunas cosas que me gustaria cambiar como por ejemplo en la pagina de Match Detail cuando analizas un encuentro, no se puede ver las cuotas de los mercados claramente en ningun lado, haya o no picks recomendados, y tambien en el apartado de Matchup, en los H2H directos, no tiene mucho sentido que pongo "W" o "L" desde una vision neutral.

Si tienes ideas de como mostrar la informacion mejor o mejorar la experiencia de usuario te escucho

## Assistant

Voy a explorar el proyecto Z-Source para entender qué tienes y luego proponerte mejoras concretas.

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_read]_

Let me look at the key tabs you mentioned (Picks, Matchup, Lines):

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_ls]_

_[tool: local_read]_

I have a clear picture now. Let me look at a couple more pieces to ground my recommendations, then build a concrete proposal mockup.

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

I have enough context now. Let me build a UI/UX proposal mockup that addresses your specific concerns and explores improvements. I'll set up a design canvas with annotated before/after frames.

_[tool: update_todos]_

_[tool: copy_starter_component]_

_[tool: snip]_

Now let me build the proposal. I'll create three frames focused on your specific pain points + a few bonus ideas.

_[tool: write_file]_

Now the frame components — split for clarity:

_[tool: write_file]_

_[tool: write_file]_

_[tool: snip]_

Now the canvas host:

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Listo. Te dejo el archivo abierto: **UI-UX Proposal.html**.

Resumen de lo que vas a encontrar en el canvas:

**Fixes principales** (lo que pediste)
- *Picks tab · with picks* — añade un **Odds Board** persistente debajo de los picks: grid mercado-por-mercado con la mejor cuota siempre visible, picks resaltados in-place en verde, y mejor cuota no-pick en cian. EV/edge por celda.
- *Picks tab · no picks* — el banner pasa a ser una franja delgada; el board se renderiza igual, y debajo un rail de "selecciones más cercanas al threshold" para que entiendas *por qué* no salió nada.
- *Matchup · H2H* — toggle de perspectiva (Home / Neutral / Away). En modo neutral el badge muestra "Sevilla won" en vez de W/L. Cada fila visualiza explícitamente quién jugaba en casa ese día (columna izquierda = local de aquel partido, derecha = visitante), eliminando la ambigüedad.

**Bonus** (por si quieres tirar del hilo)
- *Header KPI strip* — 6 señales rápidas (picks, sharp move, public side, KEY injuries, rest, weather) sobre el fold.
- *Lines · opener-vs-now* — tarjetas por selección con Δ de probabilidad implícita.

Si te convence alguna dirección concreta dime cuál y la llevamos a código sobre los componentes reales (`PicksTab.tsx`, `MatchupTab.tsx`, etc.).

## User

Mmmh no me convece mucho como muestras las Odds de un partido. Aunque este señalizado, visualmente parecen mas picks a mi parecer. Ademas, con ese diseño no permite mirar lineas alternativas de mercados como Asian Handicap o Totales

## Assistant

Tienes razón — visualmente compiten con los picks y no resuelven el caso real (líneas alternativas). Voy a rediseñarlo como una **tabla densa de mercado** estilo terminal/sportsbook, con líneas alternativas en filas y casas en columnas.

_[tool: read_file]_

_[tool: snip]_

Voy a reemplazar la sección del odds board con un diseño totalmente diferente: tabla densa con líneas alternativas en filas, casas en columnas, navegación por mercado a la izquierda. Mucho más cerca del lenguaje de un terminal de trading que de cards-as-picks.

_[tool: write_file]_

Now rewrite the picks frames to use the new board:

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Listo. Rediseñé el odds board como una **tabla densa estilo terminal**:

- **Rail izquierdo** con los mercados (ML, OU, AH, BTTS, DNB) y conteo de líneas + picks
- **Filas = selecciones/líneas alternativas** — ahora ves O/U 1.5, 2.0, 2.5, 3.0, 3.5 y AH desde −0.75 a 0
- **Columnas = Fair / Mkt / Edge / Best**, con toggle a "All books" que despliega Pinnacle, Bet365, William, Betfair, 1xBet
- Picks marcados solo con barra fina + chip "PICK", sin convertirse en cards que compitan visualmente
- Edge coloreado por celda (verde ≥ 3%, azul ≥ 1%, gris si negativo)

Y el estado sin picks usa exactamente la misma tabla — abierta directamente en modo "All books" para inspeccionar el mercado entero.

