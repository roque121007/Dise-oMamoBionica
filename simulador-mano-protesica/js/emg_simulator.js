/**
 * emg_simulator.js
 * Simulador de Señales Mioeléctricas (EMG) de Superficie
 * Basado en: Tesis UACM (Vargas Jacob 2014) & UIUC Sensorimotor Hand (Akhtar et al. 2016)
 * Modela potenciales de acción de unidades motoras (MUAP) para:
 * - Músculo Flexor Común Superficial de los Dedos (Flexión / Cierre de agarre)
 * - Músculo Extensor Común de los Dedos (Extensión / Apertura de mano)
 */

export class EMGSimulator {
    constructor() {
        this.sampleRate = 1000; // 1000 Hz muestreo típico de ADC biomédico
        this.flexorActivity = 0.0; // 0.0 (reposo) a 1.0 (máxima contracción voluntaria MVC)
        this.extensorActivity = 0.0;
        this.noiseFloor = 0.04; // Ruido de electrodos de superficie (mV)
        this.hum60Hz = true; // Interferencia de red eléctrica

        // Estados del envelope integrado
        this.flexorEnvelope = 0.0;
        this.extensorEnvelope = 0.0;
        this.envelopeFilterAlpha = 0.08; // Filtro paso bajo ~4Hz

        // Umbrales de decisión
        this.flexThreshold = 0.25;
        this.extendThreshold = 0.25;
        this.coContractionThreshold = 0.50;

        // Historial de señales para dibujo en osciloscopio
        this.rawFlexorHistory = [];
        this.rawExtensorHistory = [];
        this.envelopeFlexorHistory = [];
        this.envelopeExtensorHistory = [];
        this.historySize = 120;

        this.currentMode = "REST"; // "REST", "FLEXING", "EXTENDING", "CO_CONTRACTION"
    }

    /**
     * Ajusta la contracción intencional del usuario (0.0 a 1.0)
     */
    setUserEffort(flexorLevel, extensorLevel) {
        this.flexorActivity = Math.max(0.0, Math.min(1.0, flexorLevel));
        this.extensorActivity = Math.max(0.0, Math.min(1.0, extensorLevel));
    }

    triggerBurst(actionType, durationMs = 800) {
        if (actionType === "CLOSE") {
            this.setUserEffort(0.85, 0.05);
        } else if (actionType === "OPEN") {
            this.setUserEffort(0.05, 0.85);
        } else if (actionType === "CO_CONTRACT") {
            this.setUserEffort(0.80, 0.80);
        }
        setTimeout(() => {
            this.setUserEffort(0.0, 0.0);
        }, durationMs);
    }

    /**
     * Genera la siguiente muestra de EMG estocástico
     */
    step() {
        const t = Date.now() / 1000.0;

        // Generador de ruido gausiano (Box-Muller)
        const randGaussian = () => {
            let u = 0, v = 0;
            while(u === 0) u = Math.random();
            while(v === 0) v = Math.random();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        };

        // Ruido ambiental e interferencia de red a 60 Hz
        const lineHum = this.hum60Hz ? 0.03 * Math.sin(2 * Math.PI * 60 * t) : 0;

        // Potenciales de acción estocásticos ponderados por la activación muscular
        const flexRaw = (this.flexorActivity * 1.8 * randGaussian()) + (this.noiseFloor * randGaussian()) + lineHum;
        const extRaw = (this.extensorActivity * 1.8 * randGaussian()) + (this.noiseFloor * randGaussian()) + lineHum;

        // Rectificación de onda completa (|EMG|)
        const flexRect = Math.abs(flexRaw);
        const extRect = Math.abs(extRaw);

        // Filtro detector de envolvente (Moving Average / Leaky Integrator)
        this.flexorEnvelope = (1 - this.envelopeFilterAlpha) * this.flexorEnvelope + this.envelopeFilterAlpha * flexRect;
        this.extensorEnvelope = (1 - this.envelopeFilterAlpha) * this.extensorEnvelope + this.envelopeFilterAlpha * extRect;

        // Detección de intención del usuario (Máquina de estados mioeléctrica)
        if (this.flexorEnvelope > this.coContractionThreshold && this.extensorEnvelope > this.coContractionThreshold) {
            this.currentMode = "CO_CONTRACTION";
        } else if (this.flexorEnvelope > this.flexThreshold && this.flexorEnvelope > this.extensorEnvelope * 1.4) {
            this.currentMode = "FLEXING";
        } else if (this.extensorEnvelope > this.extendThreshold && this.extensorEnvelope > this.flexorEnvelope * 1.4) {
            this.currentMode = "EXTENDING";
        } else {
            this.currentMode = "REST";
        }

        // Registrar en búfer circular
        this.rawFlexorHistory.push(flexRaw);
        this.rawExtensorHistory.push(extRaw);
        this.envelopeFlexorHistory.push(this.flexorEnvelope);
        this.envelopeExtensorHistory.push(this.extensorEnvelope);

        if (this.rawFlexorHistory.length > this.historySize) {
            this.rawFlexorHistory.shift();
            this.rawExtensorHistory.shift();
            this.envelopeFlexorHistory.shift();
            this.envelopeExtensorHistory.shift();
        }

        return {
            flexRaw,
            extRaw,
            flexEnvelope: this.flexorEnvelope,
            extEnvelope: this.extensorEnvelope,
            mode: this.currentMode,
            flexorNormalized: Math.min(1.0, this.flexorEnvelope / 0.8),
            extensorNormalized: Math.min(1.0, this.extensorEnvelope / 0.8)
        };
    }
}
