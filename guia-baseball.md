# Guía de Modelado: Algoritmo baseball Player Props

Esta estructura define cómo tu programa debe ingerir, procesar y cruzar los datos para encontrar cuotas ineficientes en soft bookies.

## 1. Módulo de Lanzadores: Predicción de Strikeouts (Ks)

Las soft bookies suelen usar el promedio histórico de Ks de un lanzador para establecer la línea (ejemplo: Línea en 5.5 Ks). Tu algoritmo encontrará la ineficiencia evaluando el **matchup específico del día**.

### A. Métricas Base del Lanzador (Aislamiento)
El programa no mirará cuántas carreras permite el lanzador, sino su capacidad pura de engañar al bateador.
*   **K% (Strikeout Percentage):** Porcentaje de bateadores enfrentados que terminan en ponche.
*   **SwStr% (Swinging Strike Rate):** El porcentaje de lanzamientos que resultan en un swing al aire. Es el indicador predictivo más fuerte. Si un lanzador tiene un SwStr% alto pero Ks bajos recientemente, hay una regresión positiva inminente (valor oculto).
*   **CSW% (Called + Swinging Strike %):** La suma de swings al aire y strikes cantados sin que el bateador haga swing.

### B. El Rival: Análisis de la Alineación (Lineup)
Aquí es donde se genera el edge. El algoritmo evalúa a los 9 bateadores titulares confirmados.
*   **K% vs Handedness:** El programa extrae el porcentaje de ponches de la alineación rival **específicamente contra la mano de tu lanzador** (Zurdo o Diestro).
*   **Disciplina en el Plato (O-Swing%):** Porcentaje de veces que los bateadores persiguen lanzamientos fuera de la zona.

### C. El Multiplicador Ambiental (Intangibles)
*   **El Árbitro (Umpire):** Se cruza el árbitro asignado en el Home Plate. Si es un árbitro "Pitcher Friendly" (zona de strike ancha), se añade un multiplicador positivo.
*   **Clima:** Aire frío y denso = mayor movimiento de los lanzamientos con efecto (curvas, sliders) = más Ks.

### D. Lógica Matemática del Expected Ks
Tu programa calculará los ponches esperados E(K) proyectando cuántos bateadores enfrentará el lanzador (BF) y cruzando las tasas de ponche:

E(K) = ( (P_K% * L_K%) / Lg_K% ) * BF_proyectados

Donde P_K% es el % de ponches del Pitcher, L_K% es el % de ponches de la Alineación, Lg_K% es la media de la liga, y BF_proyectados son los bateadores enfrentados estimados.

---

## 2. Módulo de Bateadores: Predicción de RBIs y Bases Totales

Los RBIs (Carreras Impulsadas) dependen de que el jugador batee, pero también de que sus compañeros estén en base.

### A. Métrica de Impacto del Bateador
*   **wRC+ (Weighted Runs Created Plus):** Mide la creación total de carreras de un jugador ajustada al estadio y la liga. (100 es la media).
*   **ISO (Isolated Power):** Mide la capacidad de dar extrabases (dobles, triples, home runs). Vital para las líneas de "Más de 1.5 Bases Totales".
*   **Splits:** Rendimiento del bateador contra la mano del lanzador abridor.

### B. Contexto de la Alineación (Vital para RBIs)
*   **Orden al Bate (Batting Order):** Tu algoritmo solo debe buscar RBIs en jugadores que batean en los puestos del **3 al 5**. Ellos tienen la mayor probabilidad matemática de encontrar corredores en base (los puestos 1 y 2).
*   **OBP (On-Base Percentage) de los Predecesores:** El algoritmo evalúa a los jugadores que batean antes de tu objetivo. Si tienen un OBP alto, la probabilidad de RBI se dispara.

### C. Intangibles del Bateo
*   **Park Factors (Estadio):** Estadios como Coors Field o Great American Ball Park tienen multiplicadores positivos masivos para bateo debido a sus dimensiones y altitud.
*   **Viento:** Viento soplando hacia los jardines (Outfield) aumenta drásticamente la probabilidad de extrabases.

---

## 3. Matriz de Decisión y Ejecución (+EV)

Una vez que el algoritmo tiene sus proyecciones limpias de Ks o RBIs, cruza la información con el mercado.

| Paso | Acción del Algoritmo | Criterio de Ejecución |
| :--- | :--- | :--- |
| **1. Scraping Sharp** | Obtener la cuota de Pinnacle para el Prop. | Quitar el vig para obtener la Probabilidad Real (P_sharp). |
| **2. Proyección Propia** | Ejecutar los Módulos 1 o 2. | Obtener tu Probabilidad Predictiva (P_modelo). |
| **3. Fusión de Pesos** | Combinar ambas probabilidades. | Ej: 60% peso a P_sharp / 40% a P_modelo = P_final. |
| **4. Búsqueda Soft** | Rastrear cuotas en Bet365, Winamax, etc. | Identificar desajustes vs P_final. |
| **5. Cálculo EV** | Aplicar la fórmula de Valor Esperado. | Si EV > 3%, emitir alerta de apuesta. |

Fórmula de Valor Esperado a programar:
EV = (P_final * (Cuota Decimal - 1)) - (1 - P_final)

---

## 4. Dónde está la ventaja (El "Edge")

Las casas de apuestas recreacionales actualizan los Player Props muy tarde. Si a las 14:00 se anuncia que dos bateadores estrella del Equipo A no juegan hoy por descanso, Pinnacle ajustará instantáneamente la línea de Strikeouts del lanzador del Equipo B. Las soft bookies pueden tardar horas en ajustar esa línea. Tu algoritmo, detectando esa diferencia en la matriz de decisión (Paso 4), capturará el valor sistemáticamente.