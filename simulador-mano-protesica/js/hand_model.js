/**
 * hand_model.js
 * Generador Paramétrico y Taller de Ensamblaje 3D Pieza por Pieza (Babylon.js)
 * Permite:
 * 1. Crear la mano desde cero pieza por pieza (Socket, Chasis, Servos, Nudillos, Falanges, Tendones, FSRs)
 * 2. Vista Explosionada (Exploded View) interactiva de 0% a 100%
 * 3. Selección e inspección individual de piezas con ficha técnica CAD
 * 4. Animación de ensamblaje y desensamblaje
 * 5. Generación de mallas independientes exportables a STL
 */

export class ProstheticHandModel {
    constructor(scene, biometricsData, materialProps) {
        this.scene = scene;
        this.biometrics = biometricsData;
        this.materialProps = materialProps;

        this.rootNode = new BABYLON.TransformNode("hand_root", this.scene);
        this.parts = {};          // Catálogo de todas las piezas individuales { id: { mesh, normalPos, explodedPos, meta } }
        this.fingers = {};        // Jerarquías articuladas para movimiento de flexión
        this.materials = {};
        this.tendonLines = {};
        this.fsrSensors = {};
        this.servoDiscs = {};
        this.highlightLayer = null;

        this.explodedFactor = 0.0; // 0.0 = totalmente ensamblado, 1.0 = despiece completo
        this.selectedPartId = null;

        // Estado del ensamblaje pieza por pieza
        // Lista ordenada de IDs de piezas que se van instalando
        this.assemblySequence = [
            "socket_transradial",
            "wrist_coupler",
            "palm_chassis",
            "servo_bay_unit",
            "servo_horns",
            // Dedos
            "thumb_mcp_joint", "thumb_proximal", "thumb_distal", "thumb_fsr",
            "index_mcp_joint", "index_proximal", "index_pip_joint", "index_medial", "index_dip_joint", "index_distal", "index_fsr",
            "middle_mcp_joint", "middle_proximal", "middle_pip_joint", "middle_medial", "middle_dip_joint", "middle_distal", "middle_fsr",
            "ring_mcp_joint", "ring_proximal", "ring_pip_joint", "ring_medial", "ring_dip_joint", "ring_distal", "ring_fsr",
            "pinky_mcp_joint", "pinky_proximal", "pinky_pip_joint", "pinky_medial", "pinky_dip_joint", "pinky_distal", "pinky_fsr",
            // Tendones y acabados
            "tendon_cables",
            "silicone_grip_pads",
            "fsr_palm_sensor"
        ];

        // 6 Fases didácticas organizadas de forma pedagógica
        this.didacticPhases = [
            {
                title: "Fase 1: El Socket Anatómico & Muñeca",
                short: "Socket y Base",
                badge: "Paso 1 de 6",
                explanation: "El socket es el encaje que conecta la prótesis al muñón del brazo. Distribuye la presión uniformemente sobre la piel para evitar lesiones (Ref: Hernández UNAB 2021).",
                partIds: ["socket_transradial", "wrist_coupler"]
            },
            {
                title: "Fase 2: El Chasis de la Palma (Metacarpo)",
                short: "Chasis Palma",
                badge: "Paso 2 de 6",
                explanation: "El 'esqueleto' central impreso en 3D. Alberga los servomotores internos, guías de cables y puntos de anclaje para los 5 dedos.",
                partIds: ["palm_chassis"]
            },
            {
                title: "Fase 3: Los 'Músculos': Servomotores & Poleas",
                short: "Actuadores",
                badge: "Paso 3 de 6",
                explanation: "Bancada de 5 servomotores con reductora metálica y poleas de tracción. Transforman la señal eléctrica en fuerza mecánica para tirar de los tendones.",
                partIds: ["servo_bay_unit", "servo_horns"]
            },
            {
                title: "Fase 4: Esqueleto Articulado de los 5 Dedos",
                short: "Dedos y Pernos",
                badge: "Paso 4 de 6",
                explanation: "Falanges proximales, mediales y distales unidas por pernos de acero inoxidable, con proporciones anatómicas exactas según el estándar DIN 33 402.",
                partIds: [
                    "thumb_mcp_joint", "thumb_proximal", "thumb_distal",
                    "index_mcp_joint", "index_proximal", "index_pip_joint", "index_medial", "index_dip_joint", "index_distal",
                    "middle_mcp_joint", "middle_proximal", "middle_pip_joint", "middle_medial", "middle_dip_joint", "middle_distal",
                    "ring_mcp_joint", "ring_proximal", "ring_pip_joint", "ring_medial", "ring_dip_joint", "ring_distal",
                    "pinky_mcp_joint", "pinky_proximal", "pinky_pip_joint", "pinky_medial", "pinky_dip_joint", "pinky_distal"
                ]
            },
            {
                title: "Fase 5: Tendones de Dyneema",
                short: "Tendones",
                badge: "Paso 5 de 6",
                explanation: "Cables de fibra Dyneema de 50 lb que viajan por canales internos desde los carretes hasta las yemas, simulando los tendones flexores humanos.",
                partIds: ["tendon_cables"]
            },
            {
                title: "Fase 6: Sensores de Fuerza FSR & Tacto",
                short: "Sensores FSR",
                badge: "Paso 6 de 6",
                explanation: "¡El sentido del tacto! Sensores de presión FSR-402 en las yemas y palma para control PID en lazo cerrado, permitiendo agarrar un huevo sin romperlo (Ref: Nicolalde UPS 2022).",
                partIds: ["thumb_fsr", "index_fsr", "middle_fsr", "ring_fsr", "pinky_fsr", "fsr_palm_sensor", "silicone_grip_pads"]
            }
        ];

        // Por defecto empieza DESDE CERO (mesa vacía)
        this.installedParts = new Set();
        this.currentPhaseIndex = 0;

        // Ángulos articulares
        this.jointAngles = {
            thumb: { mcp: 10, pip: 15, dip: 10, opposition: 35 },
            index: { mcp: 10, pip: 15, dip: 10 },
            middle: { mcp: 10, pip: 15, dip: 10 },
            ring: { mcp: 10, pip: 15, dip: 10 },
            pinky: { mcp: 10, pip: 15, dip: 10 }
        };

        this.initHighlightLayer();
        this.initMaterials();
        this.buildAllPieces();
    }

    initHighlightLayer() {
        if (!this.highlightLayer) {
            this.highlightLayer = new BABYLON.HighlightLayer("hl_pieces", this.scene);
            this.highlightLayer.innerGlow = true;
            this.highlightLayer.outerGlow = true;
        }
    }

    initMaterials() {
        // Material Chasis Principal
        const structMat = new BABYLON.PBRMaterial("mat_chassis", this.scene);
        structMat.albedoColor = BABYLON.Color3.FromHexString(this.materialProps.colorHex || "#e2e8f0");
        structMat.roughness = 0.35;
        structMat.metallic = 0.15;
        this.materials.structure = structMat;

        // Material Metálico para Pernos y Ejes de Articulación (Acero Inoxidable)
        const metalMat = new BABYLON.PBRMaterial("mat_metal", this.scene);
        metalMat.albedoColor = new BABYLON.Color3(0.85, 0.88, 0.92);
        metalMat.metallic = 0.95;
        metalMat.roughness = 0.15;
        this.materials.metal = metalMat;

        // Material Silicona / Almohadilla Agarre
        const siliconeMat = new BABYLON.PBRMaterial("mat_silicone", this.scene);
        siliconeMat.albedoColor = new BABYLON.Color3(0.12, 0.12, 0.14);
        siliconeMat.roughness = 0.85;
        siliconeMat.metallic = 0.05;
        this.materials.silicone = siliconeMat;

        // Sensores FSR
        const fsrMat = new BABYLON.StandardMaterial("mat_fsr", this.scene);
        fsrMat.diffuseColor = new BABYLON.Color3(0.15, 0.65, 0.85);
        fsrMat.emissiveColor = new BABYLON.Color3(0.05, 0.25, 0.45);
        this.materials.fsr = fsrMat;

        // Servomotores (Negro carbón industrial)
        const servoMat = new BABYLON.PBRMaterial("mat_servo", this.scene);
        servoMat.albedoColor = new BABYLON.Color3(0.15, 0.18, 0.22);
        servoMat.metallic = 0.3;
        servoMat.roughness = 0.45;
        this.materials.servo = servoMat;

        // Tendones de Dyneema
        const tendonMat = new BABYLON.StandardMaterial("mat_tendon", this.scene);
        tendonMat.diffuseColor = new BABYLON.Color3(1.0, 0.35, 0.1);
        tendonMat.emissiveColor = new BABYLON.Color3(0.5, 0.15, 0.05);
        this.materials.tendon = tendonMat;
    }

    /**
     * Registra una pieza en el catálogo técnico para control de despiece y ficha CAD
     */
    registerPiece(id, mesh, meta, normalPos, explodedOffset) {
        mesh.isPickable = true;
        mesh.metadata = { id, ...meta };

        this.parts[id] = {
            id,
            mesh,
            meta,
            normalPos: normalPos.clone(),
            explodedOffset: explodedOffset.clone()
        };

        // Si la pieza no está en installedParts, ocultarla
        if (!this.installedParts.has(id)) {
            mesh.setEnabled(false);
        }
    }

    buildAllPieces() {
        const pData = this.biometrics.palm;
        const scale = 0.01; // Conversión mm a unidades de escena Babylon

        // ====================================================================
        // PIEZA 1: SOCKET TRANSRADIAL (Encaje anatómico del muñón)
        // ====================================================================
        const socketMesh = BABYLON.MeshBuilder.CreateCylinder("socket_transradial_mesh", {
            height: 90 * scale,
            diameterTop: 76 * scale,
            diameterBottom: 88 * scale,
            tessellation: 28
        }, this.scene);
        socketMesh.position = new BABYLON.Vector3(0, -95 * scale, 0);
        socketMesh.material = this.materials.structure;
        socketMesh.parent = this.rootNode;

        this.registerPiece("socket_transradial", socketMesh, {
            name: "Socket Transradial Anatómico",
            description: "Encaje termoformado o impreso en 3D que acopla la prótesis al muñón del antebrazo del paciente.",
            material: this.materialProps.name,
            weightGrams: 85,
            cadDimensions: "Alto: 90mm | Ø Sup: 76mm | Ø Inf: 88mm",
            category: "Estructura Base"
        }, socketMesh.position, new BABYLON.Vector3(0, -0.6, 0));

        // ====================================================================
        // PIEZA 2: COLLARÍN / ACOPLE DE MUÑECA
        // ====================================================================
        const wristMesh = BABYLON.MeshBuilder.CreateCylinder("wrist_coupler_mesh", {
            height: 25 * scale,
            diameter: 56 * scale,
            tessellation: 24
        }, this.scene);
        wristMesh.position = new BABYLON.Vector3(0, -40 * scale, 0);
        wristMesh.material = this.materials.metal;
        wristMesh.parent = this.rootNode;

        this.registerPiece("wrist_coupler", wristMesh, {
            name: "Collarín Articular de Muñeca",
            description: "Anillo de desacople rápido y fijación axial entre el socket y el chasis de la mano.",
            material: "Aluminio 6061 / Acero Inox",
            weightGrams: 42,
            cadDimensions: "Alto: 25mm | Diámetro: 56mm | Pernos: M3",
            category: "Mecanismo Articular"
        }, wristMesh.position, new BABYLON.Vector3(0, -0.3, 0));

        // ====================================================================
        // PIEZA 3: CHASIS METACARPIANO (PALMA)
        // ====================================================================
        const palmMesh = BABYLON.MeshBuilder.CreateBox("palm_chassis_mesh", {
            width: pData.width * scale,
            height: pData.length * 0.75 * scale,
            depth: pData.thickness * scale
        }, this.scene);
        palmMesh.position = new BABYLON.Vector3(0, 0, 0);
        palmMesh.material = this.materials.structure;
        palmMesh.parent = this.rootNode;

        this.registerPiece("palm_chassis", palmMesh, {
            name: "Chasis Metacarpiano (Palma)",
            description: "Carcasa central que soporta la bancada de servomotores, poleas de retorno y anclajes de los 5 dedos.",
            material: this.materialProps.name,
            weightGrams: 95,
            cadDimensions: `Ancho: ${pData.width}mm | Alto: ${(pData.length * 0.75).toFixed(1)}mm | Espesor: ${pData.thickness}mm`,
            category: "Chasis Central"
        }, palmMesh.position, new BABYLON.Vector3(0, 0, 0));

        // ====================================================================
        // PIEZA 4: BANCADA DE SERVOMOTORES
        // ====================================================================
        const servoBay = BABYLON.MeshBuilder.CreateBox("servo_bay_mesh", {
            width: pData.width * 0.75 * scale,
            height: pData.length * 0.45 * scale,
            depth: pData.thickness * 0.4 * scale
        }, this.scene);
        servoBay.position = new BABYLON.Vector3(0, -10 * scale, -pData.thickness * 0.35 * scale);
        servoBay.material = this.materials.servo;
        servoBay.parent = palmMesh;

        this.registerPiece("servo_bay_unit", servoBay, {
            name: "Bancada de 5 Servomotores",
            description: "Conjunto de actuadores con reductora metálica para la flexión independiente de los dedos.",
            material: "ABS / Engranajes Metálicos",
            weightGrams: 140,
            cadDimensions: "5 Servos MG996R / SG90 acoplados",
            category: "Actuadores"
        }, servoBay.position, new BABYLON.Vector3(0, 0, -0.45));

        // Carretes / Poleas de los servos
        const hornsGroup = new BABYLON.TransformNode("horns_group", this.scene);
        hornsGroup.parent = palmMesh;
        for (let i = 0; i < 5; i++) {
            const disc = BABYLON.MeshBuilder.CreateCylinder(`servo_horn_${i}`, {
                height: 4 * scale,
                diameter: 15 * scale,
                tessellation: 16
            }, this.scene);
            const xPos = (-pData.width * 0.3 + (i * pData.width * 0.15)) * scale;
            disc.position = new BABYLON.Vector3(xPos, -10 * scale, -pData.thickness * 0.52 * scale);
            disc.rotation.x = Math.PI / 2;
            disc.material = this.materials.metal;
            disc.parent = hornsGroup;
            this.servoDiscs[`finger_${i}`] = disc;
        }

        this.registerPiece("servo_horns", hornsGroup, {
            name: "Poleas / Carretes de Tracción",
            description: "Discos de aluminio montados en el eje estriado del servo que recogen el cable de tendón.",
            material: "Aluminio Torneado",
            weightGrams: 18,
            cadDimensions: "5 Carretes Ø 15mm | Radio de tracción: 7.5mm",
            category: "Transmisión"
        }, hornsGroup.position, new BABYLON.Vector3(0, 0, -0.65));

        // Sensor FSR central de palma
        const palmFSR = BABYLON.MeshBuilder.CreateDisc("fsr_palm_mesh", {
            radius: 14 * scale,
            tessellation: 20
        }, this.scene);
        palmFSR.position = new BABYLON.Vector3(0, 5 * scale, pData.thickness * 0.52 * scale);
        palmFSR.material = this.materials.fsr;
        palmFSR.parent = palmMesh;
        this.fsrSensors.palm = palmFSR;

        this.registerPiece("fsr_palm_sensor", palmFSR, {
            name: "Sensor de Presión FSR Palma",
            description: "Transductor resistivo Interlink FSR-402 para medir el 43% de fuerza transmitida a la palma.",
            material: "Película de Polímero Resistivo",
            weightGrams: 2,
            cadDimensions: "Área activa circular Ø 18mm",
            category: "Sensores"
        }, palmFSR.position, new BABYLON.Vector3(0, 0, 0.35));

        // ====================================================================
        // PIEZAS DE LOS 5 DEDOS (Articulaciones, Pernos, Falanges, Sensores)
        // ====================================================================
        const fDefs = [
            { key: "thumb", name: "Pulgar", x: -pData.width * 0.45 * scale, y: -10 * scale, z: 8 * scale, yaw: -35, isThumb: true, explodeDir: new BABYLON.Vector3(-0.5, -0.1, 0.3) },
            { key: "index", name: "Índice", x: -pData.width * 0.30 * scale, y: pData.length * 0.38 * scale, z: 0, yaw: -4, isThumb: false, explodeDir: new BABYLON.Vector3(-0.35, 0.45, 0.1) },
            { key: "middle", name: "Medio", x: -pData.width * 0.08 * scale, y: pData.length * 0.40 * scale, z: 0, yaw: 0, isThumb: false, explodeDir: new BABYLON.Vector3(-0.08, 0.55, 0.1) },
            { key: "ring", name: "Anular", x: pData.width * 0.14 * scale, y: pData.length * 0.37 * scale, z: 0, yaw: 3, isThumb: false, explodeDir: new BABYLON.Vector3(0.18, 0.48, 0.1) },
            { key: "pinky", name: "Meñique", x: pData.width * 0.34 * scale, y: pData.length * 0.32 * scale, z: 0, yaw: 8, isThumb: false, explodeDir: new BABYLON.Vector3(0.45, 0.38, 0.1) }
        ];

        fDefs.forEach(def => {
            this.buildFingerModular(def, scale, palmMesh);
        });

        // Crear tendones de tracción
        this.updateTendonLines();
        this.updatePose();
    }

    buildFingerModular(fingerDef, scale, palmMesh) {
        const fData = this.biometrics.fingers[fingerDef.key];
        const isThumb = fingerDef.isThumb;
        const key = fingerDef.key;
        const eDir = fingerDef.explodeDir;

        // Nodo raíz del dedo
        const fingerRoot = new BABYLON.TransformNode(`finger_root_${key}`, this.scene);
        fingerRoot.position = new BABYLON.Vector3(fingerDef.x, fingerDef.y, fingerDef.z);
        fingerRoot.rotation.z = (fingerDef.yaw * Math.PI) / 180;
        fingerRoot.parent = this.rootNode;

        let mcpParent = fingerRoot;
        let oppositionNode = null;
        if (isThumb) {
            oppositionNode = new BABYLON.TransformNode(`thumb_opposition`, this.scene);
            oppositionNode.rotation.y = (35 * Math.PI) / 180;
            oppositionNode.parent = fingerRoot;
            mcpParent = oppositionNode;
        }

        // --- ARTICULACIÓN MCP (Nudillo y Perno) ---
        const mcpHinge = new BABYLON.TransformNode(`mcp_joint_${key}`, this.scene);
        mcpHinge.parent = mcpParent;

        const mcpPin = BABYLON.MeshBuilder.CreateCylinder(`pin_mcp_${key}`, {
            height: fData.widthProximal * 1.15 * scale,
            diameter: 5.5 * scale,
            tessellation: 16
        }, this.scene);
        mcpPin.rotation.z = Math.PI / 2;
        mcpPin.material = this.materials.metal;
        mcpPin.parent = mcpHinge;

        this.registerPiece(`${key}_mcp_joint`, mcpPin, {
            name: `Perno Articular MCP (${fingerDef.name})`,
            description: "Pasador de acero inoxidable M3 rectificado que actúa como eje de rotación del nudillo.",
            material: "Acero Inox AISI 304",
            weightGrams: 4.5,
            cadDimensions: `Ø 5.5mm | Longitud: ${(fData.widthProximal * 1.15).toFixed(1)}mm`,
            category: "Pernos Articulares"
        }, mcpPin.position, eDir.scale(0.3));

        // --- FALANGE PROXIMAL ---
        const proxLen = fData.proximal * scale;
        const proxPhalanx = BABYLON.MeshBuilder.CreateBox(`prox_${key}`, {
            width: fData.widthProximal * scale,
            height: proxLen,
            depth: fData.thickness * scale
        }, this.scene);
        proxPhalanx.position = new BABYLON.Vector3(0, proxLen / 2, 0);
        proxPhalanx.material = this.materials.structure;
        proxPhalanx.parent = mcpHinge;

        this.registerPiece(`${key}_proximal`, proxPhalanx, {
            name: `Falange Proximal (${fingerDef.name})`,
            description: "Primer eslabón óseo de soporte. Canal interno para paso de cables y sujeción de pernos.",
            material: this.materialProps.name,
            weightGrams: 9.8,
            cadDimensions: `Largo: ${fData.proximal}mm | Ancho: ${fData.widthProximal}mm | Espesor: ${fData.thickness}mm`,
            category: "Falanges"
        }, proxPhalanx.position, eDir.scale(0.6));

        // Almohadilla antideslizante palmar en falange proximal
        const padProx = BABYLON.MeshBuilder.CreateBox(`pad_prox_${key}`, {
            width: fData.widthProximal * 0.8 * scale,
            height: proxLen * 0.7,
            depth: 2 * scale
        }, this.scene);
        padProx.position = new BABYLON.Vector3(0, proxLen / 2, fData.thickness * 0.52 * scale);
        padProx.material = this.materials.silicone;
        padProx.parent = mcpHinge;

        // --- ARTICULACIÓN PIP (Interfalángica Proximal) ---
        const pipHinge = new BABYLON.TransformNode(`pip_joint_${key}`, this.scene);
        pipHinge.position = new BABYLON.Vector3(0, proxLen, 0);
        pipHinge.parent = mcpHinge;

        let lastPhalanxHinge = pipHinge;
        let medialPhalanx = null;
        let dipHinge = null;

        if (!isThumb && fData.medial > 0) {
            const pipPin = BABYLON.MeshBuilder.CreateCylinder(`pin_pip_${key}`, {
                height: fData.widthProximal * 1.05 * scale,
                diameter: 4.8 * scale,
                tessellation: 14
            }, this.scene);
            pipPin.rotation.z = Math.PI / 2;
            pipPin.material = this.materials.metal;
            pipPin.parent = pipHinge;

            this.registerPiece(`${key}_pip_joint`, pipPin, {
                name: `Perno Articular PIP (${fingerDef.name})`,
                description: "Pasador intermedio entre falange proximal y medial con tolerancia H7/h6.",
                material: "Acero Inox AISI 304",
                weightGrams: 3.2,
                cadDimensions: `Ø 4.8mm | Longitud: ${(fData.widthProximal * 1.05).toFixed(1)}mm`,
                category: "Pernos Articulares"
            }, pipPin.position, eDir.scale(0.8));

            // Falange Medial
            const medLen = fData.medial * scale;
            medialPhalanx = BABYLON.MeshBuilder.CreateBox(`med_${key}`, {
                width: ((fData.widthProximal + fData.widthDistal) / 2) * scale,
                height: medLen,
                depth: fData.thickness * 0.9 * scale
            }, this.scene);
            medialPhalanx.position = new BABYLON.Vector3(0, medLen / 2, 0);
            medialPhalanx.material = this.materials.structure;
            medialPhalanx.parent = pipHinge;

            this.registerPiece(`${key}_medial`, medialPhalanx, {
                name: `Falange Medial (${fingerDef.name})`,
                description: "Eslabón central de transmisión que multiplica la curvatura envolvente en el agarre cilíndrico.",
                material: this.materialProps.name,
                weightGrams: 7.2,
                cadDimensions: `Largo: ${fData.medial}mm | Ancho: ${((fData.widthProximal + fData.widthDistal) / 2).toFixed(1)}mm`,
                category: "Falanges"
            }, medialPhalanx.position, eDir.scale(1.1));

            // DIP Articulación
            dipHinge = new BABYLON.TransformNode(`dip_joint_${key}`, this.scene);
            dipHinge.position = new BABYLON.Vector3(0, medLen, 0);
            dipHinge.parent = pipHinge;

            const dipPin = BABYLON.MeshBuilder.CreateCylinder(`pin_dip_${key}`, {
                height: fData.widthDistal * 1.1 * scale,
                diameter: 4.0 * scale,
                tessellation: 14
            }, this.scene);
            dipPin.rotation.z = Math.PI / 2;
            dipPin.material = this.materials.metal;
            dipPin.parent = dipHinge;

            this.registerPiece(`${key}_dip_joint`, dipPin, {
                name: `Perno Articular DIP (${fingerDef.name})`,
                description: "Pasador distal para rotación de la yema.",
                material: "Acero Inox AISI 304",
                weightGrams: 2.1,
                cadDimensions: `Ø 4.0mm | Longitud: ${(fData.widthDistal * 1.1).toFixed(1)}mm`,
                category: "Pernos Articulares"
            }, dipPin.position, eDir.scale(1.3));

            lastPhalanxHinge = dipHinge;
        }

        // --- FALANGE DISTAL (Yema) ---
        const distLen = fData.distal * scale;
        const distPhalanx = BABYLON.MeshBuilder.CreateBox(`dist_${key}`, {
            width: fData.widthDistal * scale,
            height: distLen,
            depth: fData.thickness * 0.8 * scale
        }, this.scene);
        distPhalanx.position = new BABYLON.Vector3(0, distLen / 2, 0);
        distPhalanx.material = this.materials.structure;
        distPhalanx.parent = lastPhalanxHinge;

        this.registerPiece(`${key}_distal`, distPhalanx, {
            name: `Falange Distal / Yema (${fingerDef.name})`,
            description: "Extremo distal con alojamiento para el anclaje final del tendón y sensor de presión FSR.",
            material: this.materialProps.name,
            weightGrams: 4.9,
            cadDimensions: `Largo: ${fData.distal}mm | Ancho: ${fData.widthDistal}mm | Espesor: ${(fData.thickness * 0.8).toFixed(1)}mm`,
            category: "Falanges"
        }, distPhalanx.position, eDir.scale(1.5));

        // Sensor FSR en la yema
        const fsrSensor = BABYLON.MeshBuilder.CreateBox(`fsr_tip_${key}`, {
            width: fData.widthDistal * 0.7 * scale,
            height: distLen * 0.6,
            depth: 2 * scale
        }, this.scene);
        fsrSensor.position = new BABYLON.Vector3(0, distLen / 2, fData.thickness * 0.42 * scale);
        fsrSensor.material = this.materials.fsr.clone(`mat_fsr_${key}`);
        fsrSensor.parent = lastPhalanxHinge;
        this.fsrSensors[key] = fsrSensor;

        this.registerPiece(`${key}_fsr`, fsrSensor, {
            name: `Sensor FSR Yema (${fingerDef.name})`,
            description: "Sensor resistivo Interlink 402 en la yema para lazo PID de fuerza y prevención de rotura.",
            material: "Sensor Polímero FSR-402",
            weightGrams: 0.5,
            cadDimensions: "Área de contacto: 10 x 8 mm",
            category: "Sensores"
        }, fsrSensor.position, eDir.scale(1.7));

        this.fingers[key] = {
            root: fingerRoot,
            opposition: oppositionNode,
            mcp: mcpHinge,
            pip: pipHinge,
            dip: dipHinge,
            distal: distPhalanx,
            fsr: fsrSensor,
            lengths: { proximal: fData.proximal, medial: fData.medial || 0, distal: fData.distal },
            def: fingerDef
        };
    }

    /**
     * Aplica la vista explosionada (0.0 = armada, 1.0 = totalmente despiezada)
     */
    setExplodedView(factor) {
        this.explodedFactor = Math.max(0.0, Math.min(1.0, factor));

        for (const [id, item] of Object.entries(this.parts)) {
            if (!item.mesh) continue;
            // Interpolar entre posición normal y posición explosionada
            const targetPos = item.normalPos.add(item.explodedOffset.scale(this.explodedFactor));
            item.mesh.position = targetPos;
        }

        this.updateTendonLines();
    }

    /**
     * Muestra / Oculta piezas según el estado de construcción paso a paso
     */
    setAssemblyStep(stepNumber) {
        // stepNumber de 0 (mesa vacía) a N (completamente armada)
        this.installedParts.clear();
        for (let i = 0; i < Math.min(stepNumber, this.assemblySequence.length); i++) {
            this.installedParts.add(this.assemblySequence[i]);
        }

        for (const [id, item] of Object.entries(this.parts)) {
            if (item.mesh) {
                item.mesh.setEnabled(this.installedParts.has(id));
            }
        }

        // Tendones se muestran si están instalados
        const showTendons = this.installedParts.has("tendon_cables");
        for (const line of Object.values(this.tendonLines)) {
            line.setEnabled(showTendons);
        }

        this.updateTendonLines();
    }

    assembleNextPart() {
        const currentCount = this.installedParts.size;
        if (currentCount < this.assemblySequence.length) {
            const nextPartId = this.assemblySequence[currentCount];
            this.installedParts.add(nextPartId);
            if (this.parts[nextPartId] && this.parts[nextPartId].mesh) {
                this.parts[nextPartId].mesh.setEnabled(true);
            }
            if (nextPartId === "tendon_cables") {
                for (const line of Object.values(this.tendonLines)) {
                    line.setEnabled(true);
                }
            }
            this.selectPart(nextPartId);
            this.updateTendonLines();
            return this.parts[nextPartId]?.meta || { name: nextPartId };
        }
        return null;
    }

    /**
     * Ensambla una de las 6 fases didácticas completas con todas sus piezas y animación de encaje
     */
    assemblePhase(phaseIdx) {
        if (phaseIdx < 0 || phaseIdx >= this.didacticPhases.length) return null;
        this.currentPhaseIndex = phaseIdx;
        const phase = this.didacticPhases[phaseIdx];

        // Instalar piezas de todas las fases hasta la indicada
        for (let i = 0; i <= phaseIdx; i++) {
            this.didacticPhases[i].partIds.forEach(id => {
                const wasInstalled = this.installedParts.has(id);
                this.installedParts.add(id);
                if (this.parts[id] && this.parts[id].mesh) {
                    const m = this.parts[id].mesh;
                    if (!wasInstalled) {
                        m.setEnabled(true);
                        // Animación suave de descenso / encaje elástico
                        const targetY = m.position.y;
                        m.position.y += 0.25;
                        BABYLON.Animation.CreateAndStartAnimation(
                            `snap_${id}`, m, "position.y", 30, 8,
                            targetY + 0.25, targetY,
                            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                        );
                    } else {
                        m.setEnabled(true);
                    }
                }
            });
        }

        const showTendons = this.installedParts.has("tendon_cables");
        for (const line of Object.values(this.tendonLines)) {
            line.setEnabled(showTendons);
        }

        this.updateTendonLines();
        return phase;
    }

    disassembleAll() {
        this.installedParts.clear();
        for (const item of Object.values(this.parts)) {
            if (item.mesh) item.mesh.setEnabled(false);
        }
        for (const line of Object.values(this.tendonLines)) {
            line.setEnabled(false);
        }
        this.deselectPart();
    }

    assembleAll() {
        this.assemblySequence.forEach(id => this.installedParts.add(id));
        for (const item of Object.values(this.parts)) {
            if (item.mesh) item.mesh.setEnabled(true);
        }
        for (const line of Object.values(this.tendonLines)) {
            line.setEnabled(true);
        }
        this.updateTendonLines();
    }

    selectPart(partId) {
        this.deselectPart();
        const p = this.parts[partId];
        if (p && p.mesh && this.highlightLayer) {
            this.selectedPartId = partId;
            this.highlightLayer.addMesh(p.mesh, new BABYLON.Color3(0.2, 0.8, 1.0));
            return p.meta;
        }
        return null;
    }

    deselectPart() {
        if (this.selectedPartId && this.parts[this.selectedPartId] && this.highlightLayer) {
            this.highlightLayer.removeMesh(this.parts[this.selectedPartId].mesh);
        }
        this.selectedPartId = null;
    }

    updatePose() {
        for (const [key, angles] of Object.entries(this.jointAngles)) {
            const f = this.fingers[key];
            if (!f) continue;

            const radMcp = (angles.mcp * Math.PI) / 180;
            const radPip = (angles.pip * Math.PI) / 180;
            const radDip = (angles.dip * Math.PI) / 180;

            f.mcp.rotation.x = radMcp;
            f.pip.rotation.x = radPip;
            if (f.dip) f.dip.rotation.x = radDip;
            if (f.opposition && angles.opposition !== undefined) {
                f.opposition.rotation.y = (angles.opposition * Math.PI) / 180;
            }
        }
        this.updateTendonLines();
    }

    updateTendonLines() {
        const pData = this.biometrics.palm;
        const scale = 0.01;
        const showTendons = this.installedParts.has("tendon_cables");

        for (const key of Object.keys(this.fingers)) {
            const f = this.fingers[key];
            if (!f) continue;

            if (this.tendonLines[key]) {
                this.tendonLines[key].dispose();
            }

            if (!showTendons || !f.fsr.isEnabled()) continue;

            const tipPos = f.fsr.getAbsolutePosition();
            const spoolPos = new BABYLON.Vector3(
                f.root.position.x * 0.6,
                -10 * scale,
                -pData.thickness * 0.35 * scale
            );
            const knucklePos = f.mcp.getAbsolutePosition();
            const path = [spoolPos, knucklePos, tipPos];

            this.tendonLines[key] = BABYLON.MeshBuilder.CreateLines(`tendon_${key}`, {
                points: path,
                updatable: true
            }, this.scene);
            this.tendonLines[key].color = new BABYLON.Color3(1.0, 0.4, 0.1);
        }
    }

    setSensorForceVisual(sensorKey, forceN) {
        const sensor = this.fsrSensors[sensorKey];
        if (!sensor || !sensor.material) return;
        const intensity = Math.min(1.0, forceN / 15.0);
        const r = Math.min(1.0, intensity * 1.8);
        const g = Math.max(0.1, 1.0 - Math.abs(intensity - 0.5) * 1.5);
        const b = Math.max(0.1, 0.9 - intensity * 0.85);
        sensor.material.emissiveColor = new BABYLON.Color3(r, g, b);
    }

    applyGraspPreset(presetKey) {
        switch (presetKey) {
            case "OPEN":
                this.jointAngles = {
                    thumb: { mcp: 0, pip: 0, dip: 0, opposition: 15 },
                    index: { mcp: 0, pip: 0, dip: 0 },
                    middle: { mcp: 0, pip: 0, dip: 0 },
                    ring: { mcp: 0, pip: 0, dip: 0 },
                    pinky: { mcp: 0, pip: 0, dip: 0 }
                };
                break;
            case "POWER_CYLINDER":
                this.jointAngles = {
                    thumb: { mcp: 35, pip: 45, dip: 25, opposition: 65 },
                    index: { mcp: 65, pip: 70, dip: 45 },
                    middle: { mcp: 70, pip: 75, dip: 50 },
                    ring: { mcp: 70, pip: 75, dip: 50 },
                    pinky: { mcp: 65, pip: 70, dip: 45 }
                };
                break;
            case "PRECISION_PINCH":
                this.jointAngles = {
                    thumb: { mcp: 40, pip: 50, dip: 20, opposition: 80 },
                    index: { mcp: 45, pip: 60, dip: 40 },
                    middle: { mcp: 15, pip: 10, dip: 5 },
                    ring: { mcp: 10, pip: 10, dip: 5 },
                    pinky: { mcp: 10, pip: 10, dip: 5 }
                };
                break;
            case "HOOK":
                this.jointAngles = {
                    thumb: { mcp: 0, pip: 10, dip: 0, opposition: 10 },
                    index: { mcp: 20, pip: 80, dip: 75 },
                    middle: { mcp: 20, pip: 85, dip: 80 },
                    ring: { mcp: 20, pip: 85, dip: 80 },
                    pinky: { mcp: 20, pip: 80, dip: 75 }
                };
                break;
            case "SPHERICAL":
                this.jointAngles = {
                    thumb: { mcp: 40, pip: 40, dip: 30, opposition: 70 },
                    index: { mcp: 50, pip: 55, dip: 35 },
                    middle: { mcp: 55, pip: 60, dip: 40 },
                    ring: { mcp: 55, pip: 60, dip: 40 },
                    pinky: { mcp: 50, pip: 55, dip: 35 }
                };
                break;
            case "FIST":
                this.jointAngles = {
                    thumb: { mcp: 50, pip: 60, dip: 35, opposition: 85 },
                    index: { mcp: 85, pip: 85, dip: 65 },
                    middle: { mcp: 85, pip: 90, dip: 70 },
                    ring: { mcp: 85, pip: 90, dip: 70 },
                    pinky: { mcp: 85, pip: 85, dip: 65 }
                };
                break;
            case "POINTING":
                this.jointAngles = {
                    thumb: { mcp: 45, pip: 45, dip: 20, opposition: 45 },
                    index: { mcp: 0, pip: 0, dip: 0 },
                    middle: { mcp: 85, pip: 85, dip: 70 },
                    ring: { mcp: 85, pip: 85, dip: 70 },
                    pinky: { mcp: 85, pip: 85, dip: 70 }
                };
                break;
        }
        this.updatePose();
    }

    setProportionalFlexion(flexionRatio) {
        const ratio = Math.max(0, Math.min(1.0, flexionRatio));
        this.jointAngles.thumb.mcp = 45 * ratio;
        this.jointAngles.thumb.pip = 55 * ratio;
        this.jointAngles.thumb.dip = 30 * ratio;
        this.jointAngles.thumb.opposition = 20 + 60 * ratio;

        ["index", "middle", "ring", "pinky"].forEach(k => {
            this.jointAngles[k].mcp = 75 * ratio;
            this.jointAngles[k].pip = 80 * ratio;
            this.jointAngles[k].dip = 55 * ratio;
        });

        this.updatePose();
    }

    updateMaterial(materialProps) {
        this.materialProps = materialProps;
        if (this.materials.structure) {
            this.materials.structure.albedoColor = BABYLON.Color3.FromHexString(materialProps.colorHex || "#e2e8f0");
            if (materialProps.name.includes("Carbon")) {
                this.materials.structure.metallic = 0.5;
                this.materials.structure.roughness = 0.25;
            } else if (materialProps.name.includes("Resina")) {
                this.materials.structure.metallic = 0.1;
                this.materials.structure.roughness = 0.15;
            } else {
                this.materials.structure.metallic = 0.15;
                this.materials.structure.roughness = 0.4;
            }
        }
    }

    dispose() {
        if (this.highlightLayer) {
            this.highlightLayer.dispose();
            this.highlightLayer = null;
        }
        this.rootNode.dispose();
        for (const line of Object.values(this.tendonLines)) {
            line.dispose();
        }
    }
}
