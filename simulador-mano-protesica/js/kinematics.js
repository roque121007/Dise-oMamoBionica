/**
 * kinematics.js
 * Motor Cinemático y Biomecánico para la Mano Protésica
 * Implementa:
 * 1. Cinemática Directa Denavit-Hartenberg (D-H) [Ref: Quinayás-Burgos UC-1 Hand]
 * 2. Mecánica de Tendones y Poléas (Tensión por fricción de Capstan y momentos)
 * 3. Estimación analítica de Esfuerzos de Von Mises y Factor de Seguridad [Ref: Hernández 2021]
 * 4. Modelo Transductor FSR 402 [Ref: Nicolalde & Calvache UPS 2022]
 */

export class KinematicsEngine {
    constructor() {
        this.frictionCoeff = 0.25; // Fricción entre cable de nylon/dyneema y canal guía
        this.fsrRm = 10000; // Resistencia RM en divisor de voltaje (10k ohms según UPS thesis)
        this.fsrVcc = 5.0; // Tensión de excitación 5V
    }

    /**
     * Matriz de transformación homogénea D-H clásica
     * T = [ cos(th)  -sin(th)*cos(al)   sin(th)*sin(al)   a*cos(th) ]
     *     [ sin(th)   cos(th)*cos(al)  -cos(th)*sin(al)   a*sin(th) ]
     *     [    0           sin(al)           cos(al)          d     ]
     *     [    0              0                 0             1     ]
     */
    createDHMatrix(thetaRad, d, a, alphaRad) {
        const ct = Math.cos(thetaRad);
        const st = Math.sin(thetaRad);
        const ca = Math.cos(alphaRad);
        const sa = Math.sin(alphaRad);

        return [
            [ct, -st * ca, st * sa, a * ct],
            [st, ct * ca, -ct * sa, a * st],
            [0, sa, ca, d],
            [0, 0, 0, 1]
        ];
    }

    /**
     * Multiplica dos matrices 4x4
     */
    multiplyMatrices(m1, m2) {
        const result = Array(4).fill(0).map(() => Array(4).fill(0));
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += m1[i][k] * m2[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    /**
     * Calcula la posición (X, Y, Z) en el espacio para cada articulación de un dedo
     * @param {Array} jointAngles - Ángulos en radianes [MCP_flex, PIP_flex, DIP_flex] o [CMC, MCP, IP] para pulgar
     * @param {Object} lengths - Longitudes de falanges { proximal, medial, distal }
     * @param {Object} baseOffset - Posición y orientación del nudillo en la palma { x, y, z, yaw, pitch }
     */
    forwardKinematicsFinger(jointAngles, lengths, baseOffset) {
        // Matriz base desde la muñeca al nudillo
        const radYaw = (baseOffset.yaw || 0) * Math.PI / 180;
        const radPitch = (baseOffset.pitch || 0) * Math.PI / 180;

        let T = [
            [Math.cos(radYaw), -Math.sin(radYaw), 0, baseOffset.x],
            [Math.sin(radYaw), Math.cos(radYaw), 0, baseOffset.y],
            [0, 0, 1, baseOffset.z],
            [0, 0, 0, 1]
        ];

        const jointPositions = [
            { x: T[0][3], y: T[1][3], z: T[2][3], label: "MCP (Base)" }
        ];

        // MCP -> PIP
        const th1 = jointAngles[0] || 0;
        const a1 = lengths.proximal;
        const A1 = this.createDHMatrix(th1, 0, a1, 0);
        T = this.multiplyMatrices(T, A1);
        jointPositions.push({ x: T[0][3], y: T[1][3], z: T[2][3], label: "PIP (Medial)" });

        // PIP -> DIP (Si tiene falange medial)
        if (lengths.medial > 0) {
            const th2 = jointAngles[1] || 0;
            const a2 = lengths.medial;
            const A2 = this.createDHMatrix(th2, 0, a2, 0);
            T = this.multiplyMatrices(T, A2);
            jointPositions.push({ x: T[0][3], y: T[1][3], z: T[2][3], label: "DIP (Distal)" });
        }

        // DIP -> Fingertip
        const th3 = lengths.medial > 0 ? (jointAngles[2] || 0) : (jointAngles[1] || 0);
        const a3 = lengths.distal;
        const A3 = this.createDHMatrix(th3, 0, a3, 0);
        T = this.multiplyMatrices(T, A3);
        jointPositions.push({ x: T[0][3], y: T[1][3], z: T[2][3], label: "Yema (Fingertip)" });

        return {
            positions: jointPositions,
            fingertip: jointPositions[jointPositions.length - 1],
            transformationMatrix: T
        };
    }

    /**
     * Calcula la tensión requerida en el tendón para soportar una fuerza de contacto en la yema
     * Utiliza la ecuación de momentos en las articulaciones y fricción de Euler-Eytelwein (Capstan)
     * @param {number} normalForceN - Fuerza normal en la punta del dedo (N)
     * @param {Object} fingerLengths - Longitudes de falanges en mm
     * @param {Array} jointAngles - Ángulos de flexión en rad
     * @param {number} tendonMomentArmMm - Distancia del tendón al centro del perno articular (típicamente 5-7 mm)
     */
    calculateTendonTension(normalForceN, fingerLengths, jointAngles, tendonMomentArmMm = 6.0) {
        const totalEffectiveLength = (fingerLengths.proximal + (fingerLengths.medial || 0) + fingerLengths.distal) / 1000.0; // en metros
        const rArm = tendonMomentArmMm / 1000.0; // en metros

        // Momento resistente requerido en la base MCP
        const requiredTorqueNm = normalForceN * totalEffectiveLength * 0.85; // Factor de ángulo promedio

        // Tensión base requerida en el cable sin fricción
        let tensionN = requiredTorqueNm / rArm;

        // Pérdida por fricción en las curvaturas articulares (Ecuación de Capstan)
        const totalWrapAngleRad = jointAngles.reduce((sum, angle) => sum + Math.abs(angle), 0);
        const frictionMultiplier = Math.exp(this.frictionCoeff * totalWrapAngleRad);

        const motorTensionN = tensionN * frictionMultiplier;
        const servoSpoolRadiusM = 0.012; // Radio del carrete del servomotor en palma (12 mm)
        const requiredServoTorqueNm = motorTensionN * servoSpoolRadiusM;
        const requiredServoTorqueKgCm = requiredServoTorqueNm * 10.197;

        return {
            normalForceN,
            fingertipTorqueNm: requiredTorqueNm,
            tendonTensionN: motorTensionN,
            requiredServoTorqueNm,
            requiredServoTorqueKgCm,
            frictionMultiplier
        };
    }

    /**
     * Estimación de esfuerzos de Von Mises en la falange bajo carga crítica
     * @param {number} forceN - Fuerza de carga
     * @param {number} lengthMm - Longitud del segmento
     * @param {number} widthMm - Ancho del perno/sección transversal
     * @param {number} thicknessMm - Espesor de la falange
     * @param {string} materialKey - Llave en MATERIAL_PROPERTIES (pla, petg, etc.)
     * @param {Object} materialProps - Propiedades del material
     */
    calculateVonMisesStress(forceN, lengthMm, widthMm, thicknessMm, materialProps) {
        // Sección hueca rectangular simulada para estructura 3D impresa con 50% relleno
        const b = widthMm / 1000.0;
        const h = thicknessMm / 1000.0;
        const L = lengthMm / 1000.0;

        // Momento flector crítico en la raíz: M = F * L
        const M = forceN * L;

        // Momento de inercia de sección rectangular I = (b * h^3) / 12
        const I = (b * Math.pow(h, 3)) / 12.0;
        const c = h / 2.0;

        // Esfuerzo normal por flexión: sigma_b = M * c / I
        const bendingStressPa = (M * c) / I;
        const bendingStressMPa = bendingStressPa / 1e6;

        // Esfuerzo cortante promedio: tau = 1.5 * F / A
        const A = b * h;
        const shearStressPa = (1.5 * forceN) / A;
        const shearStressMPa = shearStressPa / 1e6;

        // Esfuerzo equivalente de Von Mises en estado plano de esfuerzos:
        // sigma_vm = sqrt(sigma_x^2 + 3 * tau_xy^2)
        const vonMisesStressMPa = Math.sqrt(Math.pow(bendingStressMPa, 2) + 3 * Math.pow(shearStressMPa, 2));

        const yieldStrength = materialProps.yieldStrengthMPa;
        const safetyFactor = yieldStrength / (vonMisesStressMPa > 0.001 ? vonMisesStressMPa : 0.001);

        let status = "SEGURO";
        if (safetyFactor < 1.0) status = "FALLA INMINENTE (Deformación Plástica)";
        else if (safetyFactor < 1.5) status = "PRECAUCIÓN (Factor bajo para prótesis)";
        else if (safetyFactor >= 2.0) status = "ÓPTIMO (Apto para uso biomédico)";

        return {
            bendingStressMPa,
            shearStressMPa,
            vonMisesStressMPa,
            yieldStrengthMPa: yieldStrength,
            safetyFactor: Number(safetyFactor.toFixed(2)),
            status
        };
    }

    /**
     * Modelo de transferencia del sensor de fuerza resistivo FSR-402
     * Convierte fuerza (N) a voltaje (V) del divisor de tensión y viceversa
     * Ref: Nicolalde UPS 2022 Sección 3.8.1
     */
    forceToFSRVoltage(forceN) {
        if (forceN <= 0.02) return 0.0;
        // Gramos-fuerza: 1 N ≈ 101.97 gf
        const gramsForce = forceN * 101.97;
        // Resistencia del sensor FSR 402 en ohms (aproximación bilogarítmica del fabricante Interlink)
        // R_fsr ≈ 100,000 / (F_gf ^ 0.75) + 200
        const rFsr = Math.max(250, (120000 / Math.pow(gramsForce, 0.78)) + 300);
        // Divisor de voltaje con Rm = 10,000 ohms
        const vOut = this.fsrVcc * (this.fsrRm / (rFsr + this.fsrRm));
        return Math.min(this.fsrVcc, Math.max(0, vOut));
    }

    /**
     * Convierte lectura analógica ADC (0 - 1023 a 5V) a Fuerza estimada en Newtons
     */
    fsrAdcToForce(adcValue) {
        if (adcValue < 15) return 0.0;
        const vOut = (adcValue / 1023.0) * this.fsrVcc;
        if (vOut >= this.fsrVcc * 0.98) return 50.0; // Saturación
        // Despeje de R_fsr: Vout = Vcc * (Rm / (Rfsr + Rm)) => Rfsr = Rm * (Vcc - Vout) / Vout
        const rFsr = this.fsrRm * (this.fsrVcc - vOut) / vOut;
        // Gramos = (120000 / (Rfsr - 300)) ^ (1 / 0.78)
        if (rFsr <= 300) return 40.0;
        const gramsForce = Math.pow(120000 / (rFsr - 300), 1 / 0.78);
        return gramsForce / 101.97;
    }
}
