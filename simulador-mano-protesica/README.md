# BionicHand 3D Studio - Taller y Simulador Didáctico de Mano Protésica

**Desarrollado con Babylon.js, WebGL y Arquitectura Modular ES6**  
*Proyecto integral basado en la investigación biomecánica, robótica y mioeléctrica de 8 tesis científicas.*

---

## 🚀 Inicio Rápido (1 Clic)

1. Haz doble clic en el archivo **`start_simulator.bat`** en la carpeta principal.
2. Se iniciará el servidor local y se abrirá automáticamente tu navegador en:
   👉 **`http://localhost:8085`**

---

## 🌟 Características y Novedades del Proyecto Finalizado

### 1. Creación Paso a Paso Desde Cero
* **Mesa de trabajo vacía por defecto**: La simulación inicia sin piezas montadas (0 de 31).
* **Guía interactiva en 6 fases didácticas**:
  1. **Fase 1: El Socket Anatómico & Muñeca**: Conexión ergonómica con el muñón para distribuir la presión cutánea (Ref: Hernández UNAB 2021).
  2. **Fase 2: El Chasis de la Palma (Metacarpo)**: Estructura central donde se anclan los servomotores y articulaciones.
  3. **Fase 3: Los 'Músculos' Servomotores & Poleas**: Reductora metálica MG996R y carretes de tracción de tendón.
  4. **Fase 4: Esqueleto Articulado de los 5 Dedos**: Falanges proximales, mediales y distales con pernos pasantes de acero inoxidable según el estándar DIN 33 402 y rayos X de Buryanov (2010).
  5. **Fase 5: Tendones de Dyneema**: Cables de 50 lb que transmiten la fuerza desde el servomotor hasta las yemas.
  6. **Fase 6: Sensores de Fuerza FSR & Tacto**: Transductores Interlink FSR-402 en cada yema y en la palma para regular la presión y evitar aplastar objetos frágiles (Ref: Nicolalde UPS 2022).
* **Animaciones de caída elástica y sonido**: Al colocar una pieza o fase, desciende suavemente sobre la mesa con sonido de perno mecánico (*Web Audio API* sin archivos externos).

### 2. Interfaz Minimalista y Pantalla Limpia
* **Lienzo 3D en pantalla completa (100% viewport)** sin barras laterales estáticas que bloqueen la vista.
* **Tarjeta Didáctica Flotante**: Muestra la explicación concisa del paso actual con botón de acción y selector de fases.
* **Dock inferior interactivo**: Permite cambiar material 3D (PLA, Fibra de Carbono, PETG, Resina), activar la **Vista Explosionada (0% a 100%)**, o cambiar presets de agarre Cutkosky (*Abierta*, *Cilíndrico*, *Pinza*, *Gancho*).
* **Ficha Técnica en Drawer Lateral Deslizable**: La información densa (código C++ Arduino, lista de materiales BOM, cotas CAD) se guarda en el botón **`📋 Ficha Técnica & Exportar`** y solo aparece cuando el usuario la consulta.

### 3. Banco de Pruebas Físico y Lazo PID Adaptativo
* En el modo **🦾 Laboratorio de Pruebas**, interactúa con objetos tridimensionales reales:
  - 🥫 **Lata de refresco** (Fuerza objetivo: 11.5 N - rígida)
  - 🍾 **Botella de agua** (Fuerza objetivo: 6.0 N - elástica)
  - 📦 **Caja de cartón** (Fuerza objetivo: 3.5 N - compresible)
  - 🥚 **Huevo fresco** (Fuerza objetivo: 2.2 N - ultra frágil con alerta sonora de fractura si supera 2.8 N).
* Botón **`🎯 Agarre Automático con Control PID`**: Cierra la mano hasta que la fuerza medida por el sensor FSR se balancea exactamente con la consigna de ese objeto, evitando romperlo.

### 4. Exportaciones de Ingeniería Listas para Fabricar
* **`💾 Descargar STL de esta Pieza`**: Exporta la malla 3D individual de cualquier pieza seleccionada en formato `.stl` para Cura o PrusaSlicer.
* **`📦 Descargar Toda la Mano Ensamblada (.stl)`**: Exporta el ensamblaje completo como un único archivo 3D listo para impresión en resina o importación en SolidWorks / Fusion 360.
* **`⚡ Descargar Firmware Arduino C++ (.ino)`**: Código completo con lectura analógica FSR, sintonización PID Ziegler-Nichols y control PWM de 5 servomotores.
* **`📊 Descargar Presupuesto BOM (.csv)`**: Desglose con costos reales ($130 USD) frente al mercado comercial ($25,000 USD), demostrando más del 98% de ahorro.

---

## 📚 Tesis e Investigaciones Integradas

1. **David Hernández Valencia (UNAB, 2021)**: Biometría DIN 33 402, proporciones óseas de Buryanov (2010), distribución de fuerza de agarre cilíndrico de 100 N y análisis de esfuerzos de Von Mises.
2. **Franklin Nicolalde & Luis Calvache (UPS, 2022)**: Integración de sensores de presión FSR-402 con divisor de tensión, servomotores MG996R y control de presión PID en lazo cerrado para latas, botellas y cajas de cartón.
3. **Scott Garrett (Cal Poly, 2011)**: Plataforma de código abierto basada en microcontrolador, tracción por carretes y prueba de sujeción de huevo fresco sin rotura.
4. **César Quinayás-Burgos & Óscar Vivas-Albán (2010)**: Cinemática directa de la mano protésica UC-1 mediante matrices homogéneas de Denavit-Hartenberg (D-H).
5. **Juan Ángel Vargas Jacob (UACM, 2014)**: Fisiología mioeléctrica de los músculos flexores y extensores del antebrazo y acondicionamiento de biopotenciales EMG.
6. **Aadeel Akhtar et al. (UIUC, 2016)** & **MIT Soft Robotics (Homberg et al. 2019)**: Prótesis mioeléctrica complaciente sensorimotora de bajo costo accesible a investigadores y pacientes.
