/**
 * export_tools.js
 * Generador de Firmware C++ Arduino/ESP32, Lista de Materiales (BOM) y Parámetros de Fabricación 3D
 * Basado en las metodologías de los documentos analizados (Garrett, Hernández, Nicolalde, Akhtar)
 */

export class ExportTools {
    /**
     * Genera código de firmware Arduino C++ completamente funcional y listo para flashear
     */
    static generateArduinoFirmware(handConfig) {
        const dateStr = new Date().toLocaleDateString();
        return `/*
 * ====================================================================
 * FIRMWARE DE CONTROL PARA PRÓTESIS DE MANO MIOELÉCTRICA CON PID
 * Generado por el Simulador de Mano Protésica Babylon.js
 * Fecha: ${dateStr}
 * Referencias Técnicas:
 *  - Control PID de Presión: Nicolalde & Calvache (UPS 2022)
 *  - Arquitectura Biomecánica: Hernández Valencia (UNAB 2021)
 *  - Plataforma Abierta: Scott Garrett (Cal Poly 2011)
 * ====================================================================
 */

#include <Servo.h>

// --- ASIGNACIÓN DE PINES PWM PARA SERVOMOTORES ---
#define PIN_SERVO_THUMB   3   // Dedo Pulgar
#define PIN_SERVO_INDEX   5   // Dedo Índice
#define PIN_SERVO_MIDDLE  6   // Dedo Medio
#define PIN_SERVO_RING    9   // Dedo Anular
#define PIN_SERVO_PINKY   10  // Dedo Meñique

// --- ASIGNACIÓN DE PINES ANALÓGICOS (SENSORES FSR Y EMG) ---
#define PIN_FSR_INDEX     A0  // Sensor de Presión FSR Dedo Índice
#define PIN_FSR_MIDDLE    A1  // Sensor de Presión FSR Dedo Medio
#define PIN_FSR_THUMB     A2  // Sensor de Presión FSR Pulgar
#define PIN_EMG_FLEXOR    A3  // Sensor Mioeléctrico Músculo Flexor
#define PIN_EMG_EXTENSOR  A4  // Sensor Mioeléctrico Músculo Extensor

// --- INSTANCIAS DE SERVOS ---
Servo servoThumb;
Servo servoIndex;
Servo servoMiddle;
Servo servoRing;
Servo servoPinky;

// --- PARÁMETROS DEL CONTROLADOR PID ---
// Sintonizados mediante método de Ziegler-Nichols (Tesis UPS)
float Kp = ${handConfig.pid?.Kp || 1.45};
float Ki = ${handConfig.pid?.Ki || 0.28};
float Kd = ${handConfig.pid?.Kd || 0.08};

float targetGripForceN = ${handConfig.pid?.setpointN || 6.0}; // Fuerza de consigna (Newtons)
float currentFSRForceN = 0.0;
float error = 0.0, prevError = 0.0;
float integral = 0.0, derivative = 0.0;
float currentServoAngle = 0.0;

// Constantes divisor de tensión FSR 402 (Rm = 10k)
const float RM_OHMS = 10000.0;
const float VCC = 5.0;

// Temporización de control
unsigned long lastPidTime = 0;
const unsigned long PID_INTERVAL_MS = 20; // 50 Hz tasa de refresco

// Umbrales Mioeléctricos (EMG)
const int EMG_FLEX_THRESHOLD = 380;
const int EMG_EXT_THRESHOLD = 380;

void setup() {
  Serial.begin(115200);
  Serial.println(F("=== MANO PROTÉSICA INICIALIZADA ==="));

  // Acoplar servomotores
  servoThumb.attach(PIN_SERVO_THUMB, 544, 2400);
  servoIndex.attach(PIN_SERVO_INDEX, 544, 2400);
  servoMiddle.attach(PIN_SERVO_MIDDLE, 544, 2400);
  servoRing.attach(PIN_SERVO_RING, 544, 2400);
  servoPinky.attach(PIN_SERVO_PINKY, 544, 2400);

  // Apertura inicial en reposo
  setAllServosAngle(0);
  delay(500);
  Serial.println(F("Listo. Envíe comandos por Serial ('OPEN', 'POWER', 'PINCH', 'SET_FORCE:<N>')"));
}

void loop() {
  // 1. Lectura y procesamiento de comandos Serial
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    executeCommand(cmd);
  }

  // 2. Lectura y control EMG (Mioeléctrico)
  int emgFlex = analogRead(PIN_EMG_FLEXOR);
  int emgExt = analogRead(PIN_EMG_EXTENSOR);

  if (emgFlex > EMG_FLEX_THRESHOLD && emgExt < EMG_EXT_THRESHOLD) {
    // Activación flexora: Cierre progresivo bajo control de presión
    targetGripForceN = 8.0;
  } else if (emgExt > EMG_EXT_THRESHOLD && emgFlex < EMG_FLEX_THRESHOLD) {
    // Activación extensora: Apertura completa
    targetGripForceN = 0.0;
    setAllServosAngle(0);
  }

  // 3. Lazo de Control PID de Presión (cada 20ms)
  unsigned long now = millis();
  if (now - lastPidTime >= PID_INTERVAL_MS) {
    lastPidTime = now;
    if (targetGripForceN > 0.5) {
      runPIDStep();
    }
  }
}

// Conversión analógica a fuerza en Newtons según curva FSR-402
float readFSRForce(int pin) {
  int rawADC = analogRead(pin);
  if (rawADC < 15) return 0.0;
  float vOut = (rawADC / 1023.0) * VCC;
  if (vOut >= VCC * 0.98) return 40.0;
  float rFsr = RM_OHMS * (VCC - vOut) / vOut;
  if (rFsr <= 300.0) return 40.0;
  float gramsForce = pow(120000.0 / (rFsr - 300.0), 1.0 / 0.78);
  return gramsForce / 101.97; // Retorna Newtons
}

// Algoritmo PID en tiempo discreto
void runPIDStep() {
  currentFSRForceN = readFSRForce(PIN_FSR_INDEX);
  error = targetGripForceN - currentFSRForceN;

  float dt = PID_INTERVAL_MS / 1000.0;
  integral += error * dt;
  integral = constrain(integral, -30.0, 30.0); // Anti-windup
  derivative = (error - prevError) / dt;
  prevError = error;

  float deltaAngle = (Kp * error + Ki * integral + Kd * derivative) * 8.0 * dt;
  currentServoAngle = constrain(currentServoAngle + deltaAngle, 0.0, 160.0);

  // Aplicar a dedos de cierre
  servoIndex.write((int)currentServoAngle);
  servoMiddle.write((int)currentServoAngle);
  servoRing.write((int)(currentServoAngle * 0.9));
  servoPinky.write((int)(currentServoAngle * 0.85));
  servoThumb.write((int)(currentServoAngle * 0.7));

  // Telemetría serial
  Serial.print("Target:"); Serial.print(targetGripForceN);
  Serial.print(" Force:"); Serial.print(currentFSRForceN);
  Serial.print(" Angle:"); Serial.println(currentServoAngle);
}

void setAllServosAngle(int angle) {
  currentServoAngle = angle;
  servoThumb.write(angle);
  servoIndex.write(angle);
  servoMiddle.write(angle);
  servoRing.write(angle);
  servoPinky.write(angle);
}

void executeCommand(String cmd) {
  if (cmd == "OPEN") {
    targetGripForceN = 0.0;
    setAllServosAngle(0);
    Serial.println(F("[OK] Mano Abierta"));
  } else if (cmd == "POWER") {
    targetGripForceN = 12.0;
    Serial.println(F("[OK] Modo Agarre de Potencia Activado"));
  } else if (cmd == "PINCH") {
    setAllServosAngle(0);
    servoIndex.write(75);
    servoThumb.write(70);
    Serial.println(F("[OK] Modo Pinza Trípode / Precisión"));
  } else if (cmd.startsWith("SET_FORCE:")) {
    targetGripForceN = cmd.substring(10).toFloat();
    Serial.print(F("[OK] Fuerza de consigna ajustada a: "));
    Serial.println(targetGripForceN);
  }
}
`;
    }

    /**
     * Genera la Lista de Materiales (BOM) detallada con estimación de costos y pesos
     */
    static generateBOM(handConfig) {
        const material = handConfig.material || { name: "PLA Biocompatible", costPerKgUSD: 20.0 };
        const actuator = handConfig.actuator || { name: "MG996R", costUSD: 9.50, weightGrams: 55 };
        const numServos = 5;

        // Estimación de peso de componentes impresos
        const printedWeightGrams = 280; // Palma + 5 dedos + socket transradial
        const filamentCost = (printedWeightGrams / 1000.0) * material.costPerKgUSD;
        const servosCost = numServos * actuator.costUSD;
        const totalServosWeight = numServos * actuator.weightGrams;

        const items = [
            { category: "Estructura 3D", item: `Filamento ${material.name} (Chasis, Falanges, Socket)`, qty: `${printedWeightGrams} g`, costUSD: filamentCost.toFixed(2) },
            { category: "Actuadores", item: `Servomotores ${actuator.name} (Torque alto, engranajes metálicos)`, qty: `${numServos} unidades`, costUSD: servosCost.toFixed(2) },
            { category: "Sensores FSR", item: "Sensores de Presión Resistivos Interlink FSR-402 (Yemas y Palma)", qty: "5 unidades", costUSD: "32.50" },
            { category: "Sensores EMG", item: "Módulo Mioeléctrico MyoWare 2.0 / EMG Superficie de 2 canales", qty: "1 set", costUSD: "38.00" },
            { category: "Transmisión", item: "Línea trenzada de Dyneema/Kevlar 0.6mm (Cables de tendón 50lb)", qty: "10 metros", costUSD: "8.50" },
            { category: "Retorno Elástico", item: "Resortes de compresión o bandas de silicona para extensión pasiva", qty: "10 unidades", costUSD: "4.50" },
            { category: "Pernos y Tornillería", item: "Ejes de pasador M2/M3 de acero inoxidable y tornillos avellanados", qty: "1 kit", costUSD: "7.00" },
            { category: "Control y Potencia", item: "Microcontrolador Arduino Nano / ESP32 + Regulador BEC 5V/6V 5A", qty: "1 set", costUSD: "16.00" },
            { category: "Almohadillas", item: "Revestimiento de silicona antideslizante o TPU en yemas", qty: "5 piezas", costUSD: "3.50" }
        ];

        let totalCost = items.reduce((sum, item) => sum + parseFloat(item.costUSD), 0);
        const totalWeight = printedWeightGrams + totalServosWeight + 120; // Estructura + servos + tornillería y electrónica

        return {
            items,
            totalCostUSD: totalCost.toFixed(2),
            totalWeightGrams: totalWeight,
            commercialCostComparisonUSD: "18,000.00 - 45,000.00",
            savingsPercentage: ((1 - (totalCost / 20000.0)) * 100).toFixed(1)
        };
    }

    /**
     * Exporta una malla de Babylon.js a formato STL 3D real imprimible (.stl)
     */
    static exportMeshToSTL(mesh, partName = "pieza_mano_protesica") {
        if (!mesh) return null;
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const indices = mesh.getIndices();
        if (!positions || !indices) return null;

        let stl = `solid ${partName.replace(/\s+/g, '_')}\n`;
        // Multiplicador para pasar de escala de escena (0.01) a milímetros reales (x100)
        const scaleToMm = 100.0;

        for (let i = 0; i < indices.length; i += 3) {
            const idx1 = indices[i] * 3;
            const idx2 = indices[i + 1] * 3;
            const idx3 = indices[i + 2] * 3;

            const v1x = (positions[idx1] * scaleToMm).toFixed(4);
            const v1y = (positions[idx1 + 1] * scaleToMm).toFixed(4);
            const v1z = (positions[idx1 + 2] * scaleToMm).toFixed(4);

            const v2x = (positions[idx2] * scaleToMm).toFixed(4);
            const v2y = (positions[idx2 + 1] * scaleToMm).toFixed(4);
            const v2z = (positions[idx2 + 2] * scaleToMm).toFixed(4);

            const v3x = (positions[idx3] * scaleToMm).toFixed(4);
            const v3y = (positions[idx3 + 1] * scaleToMm).toFixed(4);
            const v3z = (positions[idx3 + 2] * scaleToMm).toFixed(4);

            stl += `  facet normal 0.0 0.0 0.0\n`;
            stl += `    outer loop\n`;
            stl += `      vertex ${v1x} ${v1y} ${v1z}\n`;
            stl += `      vertex ${v2x} ${v2y} ${v2z}\n`;
            stl += `      vertex ${v3x} ${v3y} ${v3z}\n`;
            stl += `    endloop\n`;
            stl += `  endfacet\n`;
        }
        stl += `endsolid ${partName.replace(/\s+/g, '_')}\n`;
        return stl;
    }

    /**
     * Exporta toda la mano ensamblada como un solo archivo STL completo (.stl)
     */
    static exportFullAssemblyToSTL(partsDict, assemblyName = "mano_protesica_completa") {
        let stl = `solid ${assemblyName}\n`;
        const scaleToMm = 100.0;
        let totalFacets = 0;

        for (const [id, item] of Object.entries(partsDict)) {
            if (!item.mesh || !item.mesh.isEnabled()) continue;
            const positions = item.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const indices = item.mesh.getIndices();
            if (!positions || !indices) continue;

            const worldMatrix = item.mesh.computeWorldMatrix(true);

            for (let i = 0; i < indices.length; i += 3) {
                const idx1 = indices[i] * 3;
                const idx2 = indices[i + 1] * 3;
                const idx3 = indices[i + 2] * 3;

                // Transformar vértices a coordenadas mundiales
                const p1 = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(positions[idx1], positions[idx1 + 1], positions[idx1 + 2]), worldMatrix);
                const p2 = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(positions[idx2], positions[idx2 + 1], positions[idx2 + 2]), worldMatrix);
                const p3 = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(positions[idx3], positions[idx3 + 1], positions[idx3 + 2]), worldMatrix);

                stl += `  facet normal 0.0 0.0 0.0\n`;
                stl += `    outer loop\n`;
                stl += `      vertex ${(p1.x * scaleToMm).toFixed(4)} ${(p1.y * scaleToMm).toFixed(4)} ${(p1.z * scaleToMm).toFixed(4)}\n`;
                stl += `      vertex ${(p2.x * scaleToMm).toFixed(4)} ${(p2.y * scaleToMm).toFixed(4)} ${(p2.z * scaleToMm).toFixed(4)}\n`;
                stl += `      vertex ${(p3.x * scaleToMm).toFixed(4)} ${(p3.y * scaleToMm).toFixed(4)} ${(p3.z * scaleToMm).toFixed(4)}\n`;
                stl += `    endloop\n`;
                stl += `  endfacet\n`;
                totalFacets++;
            }
        }

        stl += `endsolid ${assemblyName}\n`;
        return totalFacets > 0 ? stl : null;
    }

    /**
     * Parámetros recomendados de laminado e impresión 3D
     */
    static get3DPrintingAdvice(materialKey) {
        return {
            orientation: "Horizontal en el eje de los pernos: Orienta las falanges para que las líneas de capa sean perpendiculares al tendón, evitando cizallamiento entre capas durante el agarre de 100 N.",
            infill: "50% a 70% patrón Giroide (Gyroid) o Cúbico para distribuir esfuerzos multidireccionales de Von Mises.",
            perimeters: "Mínimo 4 o 5 perímetros de pared (Wall Line Count) con espesor de capa de 0.16mm o 0.20mm.",
            nozzle: "0.4 mm de latón o acero endurecido.",
            tolerances: "Dejar holgura de 0.25 mm a 0.35 mm en agujeros para pernos articulares de pasadores pasantes."
        };
    }
}
