/**
 * biometrics.js
 * Base de datos antropométrica y biomecánica extraída de los documentos de investigación:
 * - DIN 33 402 (Estándar alemán de ergonomía humana)
 * - Buryanov & Kotiuk (2010) - Análisis radiológico de proporciones de falanges (66 adultos)
 * - Loaiza et al. - Medidas dimensionales de dedos en población latinoamericana
 * - David Hernández Valencia (UNAB 2021) - Prótesis de potencia para dismelia/amputación
 * - Nicolalde & Calvache (UPS 2022) - Mano robótica con control de presión FSR y MG996R
 * - Scott Garrett (Cal Poly 2011) - Plataforma de mano protésica de código abierto
 * - Akhtar et al. (UIUC 2016) - Mano sensorimotora mioeléctrica complaciente de bajo costo
 */

export const ANTHROPOMETRIC_DATA = {
    // Datos de Buryanov & Kotiuk (2010) (Valores en milímetros: media ± desviación estándar)
    buryanov: {
        name: "Estándar Clínico Radiológico (Buryanov 2010)",
        description: "Mediciones óseas extraídas mediante rayos X en 66 pacientes adultos sin patologías.",
        fingers: {
            thumb: {
                name: "Pulgar",
                metacarpal: 46.22,
                proximal: 31.57,
                medial: 0, // El pulgar no tiene falange medial
                distal: 21.67,
                widthProximal: 19.0,
                widthDistal: 15.0,
                thickness: 15.5
            },
            index: {
                name: "Índice",
                metacarpal: 68.12,
                proximal: 39.78,
                medial: 22.38,
                distal: 15.82,
                widthProximal: 16.0,
                widthDistal: 13.0,
                thickness: 12.0
            },
            middle: {
                name: "Medio / Corazón",
                metacarpal: 64.60,
                proximal: 44.63,
                medial: 26.33,
                distal: 17.40,
                widthProximal: 16.5,
                widthDistal: 13.5,
                thickness: 12.0
            },
            ring: {
                name: "Anular",
                metacarpal: 58.00,
                proximal: 41.37,
                medial: 25.65,
                distal: 17.30,
                widthProximal: 15.5,
                widthDistal: 12.5,
                thickness: 11.0
            },
            pinky: {
                name: "Meñique",
                metacarpal: 53.69,
                proximal: 32.74,
                medial: 18.11,
                distal: 15.96,
                widthProximal: 14.0,
                widthDistal: 11.0,
                thickness: 10.0
            }
        },
        palm: {
            length: 105.0,
            width: 84.0,
            thickness: 24.0
        }
    },

    // Datos DIN 33 402 / Loaiza
    din33402: {
        name: "Estándar Industrial Ergonómico (DIN 33 402)",
        description: "Estándar antropométrico industrial para diseño de herramientas y prótesis ergonómicas.",
        fingers: {
            thumb: { name: "Pulgar", metacarpal: 45.0, proximal: 37.0, medial: 0, distal: 31.0, widthProximal: 19, widthDistal: 15, thickness: 16 },
            index: { name: "Índice", metacarpal: 65.0, proximal: 32.0, medial: 26.0, distal: 18.0, widthProximal: 16, widthDistal: 13, thickness: 13 },
            middle: { name: "Medio", metacarpal: 66.0, proximal: 35.0, medial: 29.0, distal: 20.0, widthProximal: 16, widthDistal: 13, thickness: 13 },
            ring: { name: "Anular", metacarpal: 60.0, proximal: 30.0, medial: 28.0, distal: 20.0, widthProximal: 15, widthDistal: 12, thickness: 12 },
            pinky: { name: "Meñique", metacarpal: 52.0, proximal: 25.0, medial: 20.0, distal: 17.0, widthProximal: 14, widthDistal: 11, thickness: 11 }
        },
        palm: {
            length: 100.0,
            width: 82.0,
            thickness: 22.0
        }
    },

    // Caso clínico David Hernández (UNAB 2021) - Paciente Maicol Mora (Dismelia congénita)
    powerGripSport: {
        name: "Prótesis Deportiva / Agarre de Potencia (Hernández 2021)",
        description: "Optimizado para levantamiento en gimnasio (barra de dominadas, mancuernas) con socket reforzado y máxima área de contacto cilíndrico.",
        fingers: {
            thumb: { name: "Pulgar Reforzado", metacarpal: 48.0, proximal: 38.0, medial: 0, distal: 30.0, widthProximal: 22, widthDistal: 18, thickness: 18 },
            index: { name: "Índice Reforzado", metacarpal: 70.0, proximal: 42.0, medial: 25.0, distal: 19.0, widthProximal: 18, widthDistal: 15, thickness: 15 },
            middle: { name: "Medio Reforzado", metacarpal: 68.0, proximal: 46.0, medial: 28.0, distal: 21.0, widthProximal: 18, widthDistal: 15, thickness: 15 },
            ring: { name: "Anular Reforzado", metacarpal: 62.0, proximal: 43.0, medial: 27.0, distal: 20.0, widthProximal: 17, widthDistal: 14, thickness: 14 },
            pinky: { name: "Meñique Reforzado", metacarpal: 55.0, proximal: 35.0, medial: 20.0, distal: 18.0, widthProximal: 16, widthDistal: 13, thickness: 13 }
        },
        palm: {
            length: 110.0,
            width: 88.0,
            thickness: 28.0
        }
    },

    // Mano pediátrica / juvenil compacta
    pediatric: {
        name: "Pediátrica / Juvenil (Escala 75%)",
        description: "Dimensiones ajustadas para niños o adolescentes de complexión reducida.",
        fingers: {
            thumb: { name: "Pulgar", metacarpal: 34.0, proximal: 24.0, medial: 0, distal: 18.0, widthProximal: 14, widthDistal: 11, thickness: 11 },
            index: { name: "Índice", metacarpal: 50.0, proximal: 29.0, medial: 17.0, distal: 12.0, widthProximal: 12, widthDistal: 10, thickness: 9 },
            middle: { name: "Medio", metacarpal: 48.0, proximal: 33.0, medial: 19.0, distal: 13.0, widthProximal: 12, widthDistal: 10, thickness: 9 },
            ring: { name: "Anular", metacarpal: 43.0, proximal: 30.0, medial: 18.0, distal: 13.0, widthProximal: 11, widthDistal: 9, thickness: 8.5 },
            pinky: { name: "Meñique", metacarpal: 39.0, proximal: 24.0, medial: 13.0, distal: 12.0, widthProximal: 10, widthDistal: 8, thickness: 7.5 }
        },
        palm: {
            length: 78.0,
            width: 63.0,
            thickness: 18.0
        }
    }
};

/**
 * Distribución biomecánica de fuerza según Tesis de Hernández Valencia (Tabla 14 y Rossi 2012):
 * - Agonistas (4 dedos): 47% del total
 *    * Índice: 37% de los 4 dedos (17.39 N de 100 N total)
 *    * Medio: 31% de los 4 dedos (14.57 N)
 *    * Anular: 21% de los 4 dedos (9.87 N)
 *    * Meñique: 11% de los 4 dedos (5.17 N)
 * - Palma: 43% del total (43.0 N)
 * - Pulgar antagonista: 10% del total (10.0 N)
 */
export const FORCE_DISTRIBUTION = {
    totalPowerGripCapacityN: 100.0, // Meta objetivo del proyecto Hernández 2021
    proportions: {
        agonistFingers: 0.47,
        palm: 0.43,
        thumb: 0.10
    },
    fingerShareOfAgonist: {
        index: 0.37,
        middle: 0.31,
        ring: 0.21,
        pinky: 0.11
    },
    phalanxDistributionPerFinger: {
        distal: 0.50,
        medial: 0.18,
        proximal: 0.32
    }
};

/**
 * Propiedades de materiales para impresión 3D y simulación de esfuerzos (Von Mises)
 */
export const MATERIAL_PROPERTIES = {
    pla: {
        name: "PLA (Ácido Poliláctico)",
        density: 1.24, // g/cm3
        yieldStrengthMPa: 45.0, // Límite de fluencia
        ultimateTensileStrengthMPa: 60.0,
        youngsModulusGPa: 3.5,
        costPerKgUSD: 20.0,
        printTempC: 210,
        bedTempC: 60,
        colorHex: "#e2e8f0"
    },
    petg: {
        name: "PETG (Polietileno Tereftalato Glicol)",
        density: 1.27,
        yieldStrengthMPa: 50.0,
        ultimateTensileStrengthMPa: 53.0,
        youngsModulusGPa: 2.1,
        costPerKgUSD: 25.0,
        printTempC: 240,
        bedTempC: 75,
        colorHex: "#38bdf8"
    },
    carbonFiberNylon: {
        name: "Nylon PA12 + Fibra de Carbono",
        density: 1.15,
        yieldStrengthMPa: 95.0,
        ultimateTensileStrengthMPa: 120.0,
        youngsModulusGPa: 8.5,
        costPerKgUSD: 85.0,
        printTempC: 280,
        bedTempC: 90,
        colorHex: "#1e293b"
    },
    resinTough: {
        name: "Resina Tough / ABS-Like (SLA)",
        density: 1.18,
        yieldStrengthMPa: 55.0,
        ultimateTensileStrengthMPa: 65.0,
        youngsModulusGPa: 2.7,
        costPerKgUSD: 50.0,
        printTempC: 25,
        bedTempC: 25,
        colorHex: "#94a3b8"
    },
    tpuSilicone: {
        name: "TPU 95A / Almohadillas de Agarre",
        density: 1.21,
        yieldStrengthMPa: 15.0,
        ultimateTensileStrengthMPa: 35.0,
        youngsModulusGPa: 0.05,
        costPerKgUSD: 35.0,
        printTempC: 225,
        bedTempC: 50,
        colorHex: "#f97316"
    }
};

/**
 * Catálogo de servomotores y actuadores referenciados en los proyectos:
 * - MG996R / MG995: Utilizado en tesis UPS (Nicolalde 2022) y David Hernández
 * - SG90 Micro: Pruebas de bajo peso / dedos individuales
 * - Actuador lineal micrométrico
 * - Maxon DC Motor (alta gama en Akhtar UIUC)
 */
export const ACTUATOR_SPECS = {
    mg996r: {
        name: "TowerPro MG996R (Engranaje Metálico)",
        torqueKgCm: 11.0, // a 6V (1.08 N.m)
        speedSec60Deg: 0.15,
        weightGrams: 55.0,
        operatingVoltage: 6.0,
        maxCurrentAmps: 2.5,
        stallTorqueNm: 1.08,
        costUSD: 9.50,
        dimensionsMm: { x: 40.7, y: 19.7, z: 42.9 }
    },
    sg90: {
        name: "TowerPro SG90 (Micro Servo 9g)",
        torqueKgCm: 1.8, // a 4.8V (0.176 N.m)
        speedSec60Deg: 0.10,
        weightGrams: 9.0,
        operatingVoltage: 5.0,
        maxCurrentAmps: 0.6,
        stallTorqueNm: 0.18,
        costUSD: 3.00,
        dimensionsMm: { x: 22.2, y: 11.8, z: 31.0 }
    },
    linearActuator: {
        name: "Actuador Lineal Micro 50mm",
        torqueKgCm: 18.0,
        speedSec60Deg: 0.25,
        weightGrams: 68.0,
        operatingVoltage: 12.0,
        maxCurrentAmps: 1.2,
        stallTorqueNm: 1.76,
        costUSD: 24.00,
        dimensionsMm: { x: 75.0, y: 20.0, z: 20.0 }
    }
};
