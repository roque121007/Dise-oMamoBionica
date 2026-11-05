/**
 * pid_controller.js
 * Controlador PID para Regulación de Fuerza de Agarre y Prevención de Aplastamiento
 * Basado en: Tesis Universidad Politécnica Salesiana (Nicolalde & Calvache 2022)
 * "Diseño y Construcción de un Prototipo de Mano Robótica con Control de Presión"
 */

export class GripPIDController {
    constructor(config = {}) {
        // Parámetros por sintonización Ziegler-Nichols
        this.Kp = config.Kp !== undefined ? config.Kp : 1.45;
        this.Ki = config.Ki !== undefined ? config.Ki : 0.28;
        this.Kd = config.Kd !== undefined ? config.Kd : 0.08;

        this.setpointN = config.setpointN || 5.0; // Fuerza objetivo en Newtons
        this.integral = 0;
        this.previousError = 0;
        this.lastTime = Date.now();

        // Límites de salida del servomotor (0 a 180 grados)
        this.outputMin = 0.0;
        this.outputMax = 180.0;
        this.currentOutputAngle = 0.0;

        // Historial de telemetría para gráficas
        this.history = [];
        this.maxHistoryLength = 100;
        this.enabled = true;

        // Objetos de prueba estandarizados en la tesis
        this.targetObjects = {
            cardboardBox: { name: "Caja de Cartón", targetForceN: 3.5, stiffness: 0.8, fragility: "Media" },
            plasticBottle: { name: "Botella de Plástico", targetForceN: 6.0, stiffness: 1.2, fragility: "Media-Baja" },
            sodaCan: { name: "Lata de Refresco", targetForceN: 11.5, stiffness: 3.0, fragility: "Baja" },
            toiletPaper: { name: "Rollo de Papel Higiénico", targetForceN: 1.8, stiffness: 0.3, fragility: "Muy Alta" },
            rawEgg: { name: "Huevo Fresco (Cal Poly Test)", targetForceN: 2.2, stiffness: 4.5, fragility: "Crítica" }
        };
    }

    setGripTarget(objectKey) {
        if (this.targetObjects[objectKey]) {
            this.setpointN = this.targetObjects[objectKey].targetForceN;
            this.reset();
            return this.targetObjects[objectKey];
        }
        return null;
    }

    setCustomSetpoint(forceN) {
        this.setpointN = Math.max(0.1, Math.min(50.0, forceN));
    }

    setGains(kp, ki, kd) {
        this.Kp = parseFloat(kp);
        this.Ki = parseFloat(ki);
        this.Kd = parseFloat(kd);
    }

    reset() {
        this.integral = 0;
        this.previousError = 0;
        this.lastTime = Date.now();
        this.history = [];
    }

    /**
     * Ciclo de actualización del control en tiempo discreto
     * @param {number} measuredForceN - Lectura actual del sensor FSR
     * @param {number} dtSec - Paso temporal en segundos (opcional)
     * @returns {Object} Resultado con nuevo ángulo de servo, error, y componentes P, I, D
     */
    update(measuredForceN, dtSec = null) {
        if (!this.enabled) {
            return {
                outputAngle: this.currentOutputAngle,
                error: 0,
                measuredForceN,
                setpointN: this.setpointN,
                P: 0, I: 0, D: 0
            };
        }

        const now = Date.now();
        const dt = dtSec !== null ? dtSec : Math.max(0.01, (now - this.lastTime) / 1000.0);
        this.lastTime = now;

        // Error: Diferencia entre fuerza deseada y medida
        const error = this.setpointN - measuredForceN;

        // Término Proporcional
        const P = this.Kp * error;

        // Término Integral con anti-windup
        this.integral += error * dt;
        const maxIntegral = 30.0;
        this.integral = Math.max(-maxIntegral, Math.min(maxIntegral, this.integral));
        const I = this.Ki * this.integral;

        // Término Derivativo
        const derivative = (error - this.previousError) / dt;
        const D = this.Kd * derivative;
        this.previousError = error;

        // Incremento de ángulo servo en grados
        const deltaAngle = (P + I + D) * 12.0 * dt;
        this.currentOutputAngle = Math.max(this.outputMin, Math.min(this.outputMax, this.currentOutputAngle + deltaAngle));

        const entry = {
            time: (now % 60000) / 1000,
            setpoint: Number(this.setpointN.toFixed(2)),
            measured: Number(measuredForceN.toFixed(2)),
            error: Number(error.toFixed(2)),
            servoAngle: Number(this.currentOutputAngle.toFixed(1)),
            P: Number(P.toFixed(2)),
            I: Number(I.toFixed(2)),
            D: Number(D.toFixed(2))
        };

        this.history.push(entry);
        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }

        return {
            outputAngle: this.currentOutputAngle,
            error,
            measuredForceN,
            setpointN: this.setpointN,
            P, I, D,
            entry
        };
    }
}
