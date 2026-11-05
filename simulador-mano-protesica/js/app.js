/**
 * app.js
 * Coordinador Principal Didáctico y Funcional de Mano Biónica 3D (Babylon.js)
 * Integra:
 * - Modo Taller Didáctico: Ensamblaje paso a paso desde cero con explicaciones pedagógicas
 * - Modo Laboratorio de Pruebas: Banco físico interactivo (lata, botella, caja, huevo) y control PID
 * - Efectos de sonido mecánicos Web Audio (cero dependencias externas)
 * - Vista explosionada (Despiece 3D) en tiempo real
 * - Exportadores directos: STL imprimible, Firmware Arduino C++ y Presupuesto BOM
 */

import { ANTHROPOMETRIC_DATA, MATERIAL_PROPERTIES, ACTUATOR_SPECS } from './biometrics.js';
import { KinematicsEngine } from './kinematics.js';
import { GripPIDController } from './pid_controller.js';
import { ExportTools } from './export_tools.js';
import { ProstheticHandModel } from './hand_model.js';
import { soundEffects } from './sound_effects.js';

class DidacticBionicHandApp {
    constructor() {
        this.canvas = document.getElementById("renderCanvas");
        this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = null;
        this.camera = null;
        this.shadowGenerator = null;

        // Motores biomecánicos y de control
        this.kinematics = new KinematicsEngine();
        this.pid = new GripPIDController();

        // Configuración activa
        this.currentBiometrics = JSON.parse(JSON.stringify(ANTHROPOMETRIC_DATA.buryanov));
        this.currentMaterialKey = "pla";
        this.currentMaterial = MATERIAL_PROPERTIES.pla;
        this.currentActuatorKey = "mg996r";
        this.currentActuator = ACTUATOR_SPECS.mg996r;

        this.handModel = null;
        this.activeTestObjectMesh = null;
        this.activeTestObjectKey = null;

        // Modos: "workshop" (Taller) o "testing" (Pruebas)
        this.currentMode = "workshop";
        this.currentPhaseIndex = 0;
        this.isAutoPidRunning = false;
        this.simulatedForceN = 0.0;

        this.initScene();
        this.initUI();
        this.renderBOM();
        this.startRenderLoop();
    }

    initScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.10, 1.0);

        // Cámara ArcRotate suave
        this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.3, 3.4, new BABYLON.Vector3(0, 0, 0), this.scene);
        this.camera.attachControl(this.canvas, true);
        this.camera.wheelPrecision = 45;
        this.camera.lowerRadiusLimit = 1.0;
        this.camera.upperRadiusLimit = 7.0;

        // Iluminación de estudio biomédico
        const hemiLight = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        hemiLight.intensity = 0.70;
        hemiLight.groundColor = new BABYLON.Color3(0.08, 0.1, 0.14);

        const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), this.scene);
        dirLight.position = new BABYLON.Vector3(2, 4, 2);
        dirLight.intensity = 1.3;

        // Sombras suaves
        this.shadowGenerator = new BABYLON.ShadowGenerator(1024, dirLight);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;

        // Mesa de trabajo con cuadrícula milimétrica
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 14, height: 14 }, this.scene);
        ground.position.y = -1.6;
        const groundMat = new BABYLON.PBRMaterial("groundMat", this.scene);
        groundMat.albedoColor = new BABYLON.Color3(0.06, 0.08, 0.11);
        groundMat.metallic = 0.1;
        groundMat.roughness = 0.85;
        ground.material = groundMat;
        ground.receiveShadows = true;

        // Construir modelo de la mano (inicia vacía desde cero)
        this.handModel = new ProstheticHandModel(this.scene, this.currentBiometrics, this.currentMaterial);

        // Detección de clics en piezas 3D para ficha técnica
        this.scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.metadata && pickResult.pickedMesh.metadata.id) {
                const partId = pickResult.pickedMesh.metadata.id;
                const meta = this.handModel.selectPart(partId);
                if (meta) {
                    this.updateDrawerPartInfo(meta, pickResult.pickedMesh);
                    soundEffects.playSnap();
                }
            }
        };

        window.addEventListener("resize", () => this.engine.resize());
    }

    initUI() {
        // --- 1. CONMUTADOR DE MODOS (TALLER vs PRUEBAS) ---
        const btnWorkshop = document.getElementById("btnModeWorkshop");
        const btnTesting = document.getElementById("btnModeTesting");

        btnWorkshop?.addEventListener("click", () => this.switchMode("workshop"));
        btnTesting?.addEventListener("click", () => this.switchMode("testing"));

        // --- 2. ACCIONES RÁPIDAS SUPERIOR ---
        // Vaciar mesa (empezar desde cero)
        document.getElementById("btnEmptyTable")?.addEventListener("click", () => {
            this.handModel.disassembleAll();
            this.currentPhaseIndex = 0;
            this.updateDidacticCard();
            soundEffects.playSlide();
        });

        // Montar completa instantáneamente
        document.getElementById("btnFullAssemble")?.addEventListener("click", () => {
            this.handModel.assembleAll();
            this.currentPhaseIndex = this.handModel.didacticPhases.length - 1;
            this.updateDidacticCard();
            soundEffects.playSuccess();
        });

        // Toggle de Audio
        const btnAudio = document.getElementById("btnAudioToggle");
        btnAudio?.addEventListener("click", () => {
            const isEnabled = soundEffects.toggle();
            btnAudio.textContent = isEnabled ? "🔊 Audio: On" : "🔇 Audio: Off";
        });

        // Abrir y cerrar Drawer Lateral Técnico
        const drawer = document.getElementById("technicalDrawer");
        const backdrop = document.getElementById("drawerBackdrop");
        const openDrawer = () => {
            drawer?.classList.add("open");
            backdrop?.classList.add("active");
        };
        const closeDrawer = () => {
            drawer?.classList.remove("open");
            backdrop?.classList.remove("active");
        };

        document.getElementById("btnOpenDrawer")?.addEventListener("click", openDrawer);
        document.getElementById("btnCloseDrawer")?.addEventListener("click", closeDrawer);
        backdrop?.addEventListener("click", closeDrawer);

        // --- 3. TARJETA DIDÁCTICA PASO A PASO ---
        document.getElementById("btnPlaceCurrentPhase")?.addEventListener("click", () => {
            this.advanceCurrentPhase();
        });

        document.getElementById("btnPrevPhase")?.addEventListener("click", () => {
            if (this.currentPhaseIndex > 0) {
                this.currentPhaseIndex--;
                this.handModel.assemblePhase(this.currentPhaseIndex);
                this.updateDidacticCard();
                soundEffects.playSlide();
            }
        });

        document.getElementById("btnNextPhase")?.addEventListener("click", () => {
            if (this.currentPhaseIndex < this.handModel.didacticPhases.length - 1) {
                this.currentPhaseIndex++;
                this.handModel.assemblePhase(this.currentPhaseIndex);
                this.updateDidacticCard();
                soundEffects.playSlide();
            }
        });

        // --- 4. DOCK: MATERIALES DE IMPRESIÓN 3D ---
        document.querySelectorAll(".mat-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".mat-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const matKey = btn.dataset.mat;
                if (MATERIAL_PROPERTIES[matKey]) {
                    this.currentMaterialKey = matKey;
                    this.currentMaterial = MATERIAL_PROPERTIES[matKey];
                    this.handModel.updateMaterial(this.currentMaterial);
                    soundEffects.playSnap();
                }
            });
        });

        // --- 5. DOCK: VISTA EXPLOSIONADA (DESPIECE 3D) ---
        const sliderExploded = document.getElementById("sliderExplodedView");
        const labelExploded = document.getElementById("labelExplodedVal");

        if (sliderExploded) {
            sliderExploded.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value) / 100.0;
                if (labelExploded) labelExploded.textContent = `${e.target.value}%`;
                this.handModel.setExplodedView(val);
            });
        }

        document.getElementById("btnQuickExplode0")?.addEventListener("click", () => {
            if (sliderExploded) sliderExploded.value = 0;
            if (labelExploded) labelExploded.textContent = "0%";
            this.handModel.setExplodedView(0.0);
            soundEffects.playSlide();
        });

        document.getElementById("btnQuickExplode100")?.addEventListener("click", () => {
            if (sliderExploded) sliderExploded.value = 100;
            if (labelExploded) labelExploded.textContent = "100%";
            this.handModel.setExplodedView(1.0);
            soundEffects.playSlide();
        });

        // --- 6. DOCK: MODO PRUEBAS (AGARRES Y OBJETOS) ---
        // Presets Cutkosky
        document.querySelectorAll(".grasp-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".grasp-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const graspKey = btn.dataset.grasp;
                this.handModel.applyGraspPreset(graspKey);
                soundEffects.playSnap();
            });
        });

        // Slider Maestro de Cierre
        const sliderGrip = document.getElementById("sliderGripClosing");
        const labelGrip = document.getElementById("labelGripClosingVal");
        if (sliderGrip) {
            sliderGrip.addEventListener("input", (e) => {
                const ratio = parseFloat(e.target.value) / 100.0;
                if (labelGrip) labelGrip.textContent = `${e.target.value}%`;
                this.handModel.setProportionalFlexion(ratio);
                this.simulateContactForce(ratio);
            });
        }

        // Selector de Objetos de Prueba
        document.querySelectorAll(".test-obj-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".test-obj-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const objKey = btn.dataset.obj;
                this.spawnTestObject(objKey);
                soundEffects.playSnap();
            });
        });

        // Botón Agarre Automático PID
        document.getElementById("btnStartPidAutoGrip")?.addEventListener("click", () => {
            this.startPidGrasp();
        });

        // --- 7. CONTROLES DE CÁMARA ---
        document.querySelectorAll(".cam-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const view = btn.dataset.view;
                this.setCameraPreset(view);
                soundEffects.playSlide();
            });
        });

        // --- 8. EXPORTACIONES ---
        // Descargar Firmware Arduino C++
        document.getElementById("btnDownloadArduinoFirmware")?.addEventListener("click", () => {
            const code = ExportTools.generateArduinoFirmware({
                pid: this.pid,
                material: this.currentMaterial,
                actuator: this.currentActuator
            });
            this.downloadTextFile("ProstheticHand_Firmware_PID.ino", code);
            soundEffects.playSuccess();
        });

        // Descargar BOM CSV
        document.getElementById("btnDownloadBOMCSV")?.addEventListener("click", () => {
            const bom = ExportTools.generateBOM({
                material: this.currentMaterial,
                actuator: this.currentActuator
            });
            let csv = "Categoria,Componente,Cantidad,Costo Estimado (USD)\n";
            bom.items.forEach(it => {
                csv += `"${it.category}","${it.item}","${it.qty}","$${it.costUSD}"\n`;
            });
            csv += `\n"TOTAL","Costo Estimado Proyecto","1 Mano","$${bom.totalCostUSD}"\n`;
            this.downloadTextFile("BOM_Mano_Protesica.csv", csv);
            soundEffects.playSuccess();
        });

        // Descargar STL de la pieza seleccionada
        document.getElementById("btnDownloadCurrentPartSTL")?.addEventListener("click", () => {
            const partId = this.handModel.selectedPartId || "palm_chassis";
            const part = this.handModel.parts[partId];
            if (part && part.mesh) {
                const stlData = ExportTools.exportMeshToSTL(part.mesh, part.meta.name);
                if (stlData) {
                    this.downloadTextFile(`${part.meta.name.replace(/\s+/g, '_')}.stl`, stlData);
                    soundEffects.playSuccess();
                }
            } else {
                alert("Por favor selecciona primero una pieza en la pantalla 3D.");
            }
        });

        // Descargar STL de Toda la Mano Ensamblada Completa
        document.getElementById("btnDownloadFullHandSTL")?.addEventListener("click", () => {
            const stlData = ExportTools.exportFullAssemblyToSTL(this.handModel.parts, "mano_protesica_ensamble_completo");
            if (stlData) {
                this.downloadTextFile("mano_protesica_ensamble_completo.stl", stlData);
                soundEffects.playSuccess();
            } else {
                alert("La mano aún no tiene piezas montadas. Coloca piezas primero.");
            }
        });

        // Selector de Biometría en Drawer
        const bioSelect = document.getElementById("drawerBiometricsSelect");
        if (bioSelect) {
            bioSelect.addEventListener("change", (e) => {
                const key = e.target.value;
                if (ANTHROPOMETRIC_DATA[key]) {
                    this.currentBiometrics = JSON.parse(JSON.stringify(ANTHROPOMETRIC_DATA[key]));
                    const isAllInstalled = this.handModel.installedParts.size >= this.handModel.assemblySequence.length;
                    this.handModel.dispose();
                    this.handModel = new ProstheticHandModel(this.scene, this.currentBiometrics, this.currentMaterial);
                    if (isAllInstalled) {
                        this.handModel.assembleAll();
                    }
                    this.updateDidacticCard();
                    soundEffects.playSnap();
                }
            });
        }

        this.updateDidacticCard();
    }

    switchMode(mode) {
        this.currentMode = mode;
        const btnWorkshop = document.getElementById("btnModeWorkshop");
        const btnTesting = document.getElementById("btnModeTesting");
        const cardWorkshop = document.getElementById("didacticCard");
        const cardTesting = document.getElementById("testingCard");
        const dockWorkshop = document.getElementById("dockWorkshop");
        const dockTesting = document.getElementById("dockTesting");

        soundEffects.playSlide();

        if (mode === "workshop") {
            btnWorkshop?.classList.add("active");
            btnTesting?.classList.remove("active");
            if (cardWorkshop) cardWorkshop.style.display = "block";
            if (cardTesting) cardTesting.style.display = "none";
            if (dockWorkshop) dockWorkshop.style.display = "flex";
            if (dockTesting) dockTesting.style.display = "none";
            this.removeTestObject();
        } else {
            btnTesting?.classList.add("active");
            btnWorkshop?.classList.remove("active");
            if (cardWorkshop) cardWorkshop.style.display = "none";
            if (cardTesting) cardTesting.style.display = "block";
            if (dockWorkshop) dockWorkshop.style.display = "none";
            if (dockTesting) dockTesting.style.display = "flex";

            // Si la mano está incompleta, montarla automáticamente para poder probarla
            if (this.handModel.installedParts.size < this.handModel.assemblySequence.length) {
                this.handModel.assembleAll();
                this.updateDidacticCard();
            }

            // Spawnear objeto por defecto si no hay
            if (!this.activeTestObjectMesh) {
                this.spawnTestObject("sodaCan");
            }
        }
    }

    advanceCurrentPhase() {
        const phases = this.handModel.didacticPhases;
        if (this.currentPhaseIndex < phases.length) {
            this.handModel.assemblePhase(this.currentPhaseIndex);
            soundEffects.playSnap();

            if (this.currentPhaseIndex < phases.length - 1) {
                this.currentPhaseIndex++;
                this.updateDidacticCard();
            } else {
                // Última fase completada
                soundEffects.playSuccess();
                this.updateDidacticCard(true);
            }
        } else {
            // Ya completado, pasar a pruebas
            this.switchMode("testing");
        }
    }

    updateDidacticCard(isCompleted = false) {
        const phases = this.handModel.didacticPhases;
        const phase = phases[this.currentPhaseIndex];
        if (!phase) return;

        const badge = document.getElementById("phaseStepBadge");
        const partsCount = document.getElementById("phasePartsCount");
        const title = document.getElementById("didacticTitle");
        const desc = document.getElementById("didacticDesc");
        const btnPlace = document.getElementById("btnPlaceCurrentPhase");

        if (badge) badge.textContent = phase.badge;
        if (partsCount) partsCount.textContent = `${this.handModel.installedParts.size} / ${this.handModel.assemblySequence.length} Piezas`;
        if (title) title.textContent = phase.title;
        if (desc) desc.textContent = phase.explanation;

        if (btnPlace) {
            if (isCompleted || this.handModel.installedParts.size >= this.handModel.assemblySequence.length) {
                btnPlace.textContent = "✨ ¡Mano Completa! Ir a Probar";
                btnPlace.onclick = () => this.switchMode("testing");
            } else {
                btnPlace.textContent = `➕ Colocar ${phase.short}`;
                btnPlace.onclick = () => this.advanceCurrentPhase();
            }
        }

        // Actualizar puntos de progreso
        const dots = document.querySelectorAll("#phaseDotsContainer .dot");
        dots.forEach((dot, idx) => {
            dot.className = "dot";
            if (idx === this.currentPhaseIndex) dot.classList.add("active");
            else if (idx < this.currentPhaseIndex) dot.classList.add("completed");
        });
    }

    spawnTestObject(objKey) {
        this.removeTestObject();
        this.activeTestObjectKey = objKey;
        const objConfig = this.pid.setGripTarget(objKey);

        const objMat = new BABYLON.PBRMaterial(`mat_obj_${objKey}`, this.scene);
        objMat.roughness = 0.3;

        let mesh = null;
        switch (objKey) {
            case "sodaCan":
                mesh = BABYLON.MeshBuilder.CreateCylinder("obj_can", { height: 1.15, diameter: 0.66 }, this.scene);
                mesh.position = new BABYLON.Vector3(0, 0.45, 0.40);
                objMat.albedoColor = new BABYLON.Color3(0.85, 0.15, 0.18);
                objMat.metallic = 0.85;
                break;
            case "plasticBottle":
                mesh = BABYLON.MeshBuilder.CreateCylinder("obj_bottle", { height: 1.35, diameter: 0.62 }, this.scene);
                mesh.position = new BABYLON.Vector3(0, 0.48, 0.40);
                objMat.albedoColor = new BABYLON.Color3(0.2, 0.6, 0.9);
                objMat.alpha = 0.75;
                break;
            case "cardboardBox":
                mesh = BABYLON.MeshBuilder.CreateBox("obj_box", { width: 0.65, height: 0.85, depth: 0.65 }, this.scene);
                mesh.position = new BABYLON.Vector3(0, 0.45, 0.42);
                objMat.albedoColor = new BABYLON.Color3(0.72, 0.53, 0.35);
                break;
            case "rawEgg":
                mesh = BABYLON.MeshBuilder.CreateSphere("obj_egg", { diameterX: 0.45, diameterY: 0.62, diameterZ: 0.45 }, this.scene);
                mesh.position = new BABYLON.Vector3(-0.15, 0.60, 0.28);
                objMat.albedoColor = new BABYLON.Color3(0.96, 0.88, 0.76);
                break;
        }

        if (mesh) {
            mesh.material = objMat;
            this.activeTestObjectMesh = mesh;
            this.shadowGenerator.addShadowCaster(mesh);
        }
    }

    removeTestObject() {
        if (this.activeTestObjectMesh) {
            this.activeTestObjectMesh.dispose();
            this.activeTestObjectMesh = null;
            this.activeTestObjectKey = null;
        }
        this.hideFragilityBanner();
        this.updateForceUI(0);
    }

    simulateContactForce(flexRatio) {
        if (!this.activeTestObjectKey) {
            this.updateForceUI(0);
            return;
        }

        const objInfo = this.pid.targetObjects[this.activeTestObjectKey];
        const contactThreshold = 0.42;

        if (flexRatio > contactThreshold) {
            const penetration = flexRatio - contactThreshold;
            const force = penetration * 30.0 * (objInfo ? objInfo.stiffness : 1.0);
            this.simulatedForceN = force;

            this.updateForceUI(force);

            // Alerta si se sobrepasa el límite seguro en objetos frágiles
            if (this.activeTestObjectKey === "rawEgg" && force > 2.8) {
                this.showFragilityBanner("💥 ¡CUIDADO! El huevo se ha fracturado por exceso de fuerza (> 2.8 N)");
                soundEffects.playAlert();
            } else if (this.activeTestObjectKey === "cardboardBox" && force > 5.5) {
                this.showFragilityBanner("📦 Precaución: Deformación plástica severa de la caja");
            } else {
                this.hideFragilityBanner();
            }

            // Brillo en sensores FSR
            ["index", "middle", "thumb", "palm"].forEach(k => {
                this.handModel.setSensorForceVisual(k, force);
            });
        } else {
            this.updateForceUI(0);
            this.hideFragilityBanner();
            ["index", "middle", "thumb", "palm"].forEach(k => {
                this.handModel.setSensorForceVisual(k, 0);
            });
        }
    }

    startPidGrasp() {
        if (!this.activeTestObjectKey) {
            this.spawnTestObject("sodaCan");
        }
        this.isAutoPidRunning = true;
        this.pid.reset();
        soundEffects.playSnap();

        const objInfo = this.pid.targetObjects[this.activeTestObjectKey] || { targetForceN: 6.0, stiffness: 1.0 };
        const targetForce = objInfo.targetForceN;
        const slider = document.getElementById("sliderGripClosing");
        const label = document.getElementById("labelGripClosingVal");

        let currentVal = 0;
        let lastTime = performance.now();

        const stepPid = () => {
            if (!this.isAutoPidRunning) return;

            const now = performance.now();
            const dt = Math.min(0.04, (now - lastTime) / 1000.0);
            lastTime = now;

            const measuredForce = this.simulatedForceN;
            const error = targetForce - measuredForce;

            // Incremento regulado por el lazo de control PID
            let increment = 0;
            if (error > 0.15) {
                increment = Math.max(0.4, error * 1.8 * dt * 25);
            } else if (error < -0.3) {
                increment = -0.5;
            }

            currentVal = Math.max(0, Math.min(88, currentVal + increment));

            if (slider) slider.value = Math.round(currentVal);
            if (label) label.textContent = `${Math.round(currentVal)}%`;

            this.handModel.setProportionalFlexion(currentVal / 100.0);
            this.simulateContactForce(currentVal / 100.0);

            // Condición de parada estable: fuerza medida alcanza la consigna dentro de tolerancia
            if (Math.abs(this.simulatedForceN - targetForce) <= 0.4 && currentVal > 35) {
                this.isAutoPidRunning = false;
                soundEffects.playSuccess();
                return;
            }

            if (currentVal >= 88) {
                this.isAutoPidRunning = false;
                return;
            }

            requestAnimationFrame(stepPid);
        };

        requestAnimationFrame(stepPid);
    }

    updateForceUI(forceN) {
        const fillBar = document.getElementById("forceFillBar");
        const label = document.getElementById("labelForceVal");

        const maxForce = 15.0;
        const pct = Math.min(100, (forceN / maxForce) * 100);

        if (fillBar) fillBar.style.width = `${pct}%`;
        if (label) {
            label.textContent = `${forceN.toFixed(1)} N`;
            label.style.color = forceN > 10 ? "#ef4444" : (forceN > 4 ? "#f59e0b" : "#10b981");
        }
    }

    showFragilityBanner(msg) {
        const b = document.getElementById("fragilityBanner");
        if (b) {
            b.textContent = msg;
            b.style.display = "block";
        }
    }

    hideFragilityBanner() {
        const b = document.getElementById("fragilityBanner");
        if (b) b.style.display = "none";
    }

    setCameraPreset(viewName) {
        switch (viewName) {
            case "front":
                this.camera.alpha = -Math.PI / 2;
                this.camera.beta = Math.PI / 2;
                this.camera.radius = 3.3;
                break;
            case "side":
                this.camera.alpha = 0;
                this.camera.beta = Math.PI / 2;
                this.camera.radius = 3.3;
                break;
            case "top":
                this.camera.alpha = -Math.PI / 2;
                this.camera.beta = 0.1;
                this.camera.radius = 3.6;
                break;
            case "iso":
                this.camera.alpha = -Math.PI / 2.8;
                this.camera.beta = Math.PI / 2.6;
                this.camera.radius = 3.4;
                break;
        }
    }

    updateDrawerPartInfo(meta, mesh) {
        document.getElementById("drawerPartName").textContent = meta.name || "Pieza";
        document.getElementById("drawerPartCategory").textContent = meta.category || "Componente";
        document.getElementById("drawerPartMaterial").textContent = meta.material || this.currentMaterial.name;
        document.getElementById("drawerPartWeight").textContent = `${meta.weightGrams || 15} g`;
        document.getElementById("drawerPartStress").textContent = "Seguro (Von Mises < límite)";
    }

    renderBOM() {
        const tbody = document.getElementById("bomTableBody");
        if (!tbody) return;

        const bom = ExportTools.generateBOM({
            material: this.currentMaterial,
            actuator: this.currentActuator
        });

        let html = "";
        bom.items.slice(0, 5).forEach(it => {
            html += `
                <tr>
                    <td>${it.item}</td>
                    <td>${it.qty}</td>
                    <td class="cost">$${it.costUSD}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    downloadTextFile(filename, text) {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    startRenderLoop() {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }
}

// Iniciar aplicación al cargar
window.addEventListener("DOMContentLoaded", () => {
    window.didacticApp = new DidacticBionicHandApp();
});
