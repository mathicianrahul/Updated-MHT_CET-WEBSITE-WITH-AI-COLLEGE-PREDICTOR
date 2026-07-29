/* ==========================================================================
   SOFT ABSTRACT FROSTED-GLASS 3D BACKDROP - STRIPE / LINEAR EDITORIAL STYLE
   Morning Light Gradient, Translucent Frosted Glass Panels, Navy Blue Strokes
   ========================================================================== */

(function initEditorialFrosted3DEngine() {
    const canvas = document.getElementById("webgl-canvas");
    if (!canvas) return;

    if (typeof THREE === "undefined") {
        console.warn("Three.js not loaded. Skipping 3D scene initialization.");
        return;
    }

    // Ensure canvas is visible and properly positioned behind content
    canvas.style.display = "block";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.zIndex = "-1";
    canvas.style.pointerEvents = "none";

    // 1. Scene, Camera & Renderer Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.008); // Frosted morning fog

    const camera = new THREE.PerspectiveCamera(
        40,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 24);

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // 2. Diffused Lighting (Morning light through frosted glass)
    const ambientLight = new THREE.AmbientLight(0xfffdfa, 0.95); // Warm white ambient
    scene.add(ambientLight);

    const skyDirectional = new THREE.DirectionalLight(0xe0f2fe, 0.8); // Pale sky-blue directional
    skyDirectional.position.set(10, 15, 12);
    scene.add(skyDirectional);

    // Soft Emerald-Green Accent Glow (Diffused in bottom-right corner)
    const emeraldLight = new THREE.PointLight(0x10b981, 1.2, 35);
    emeraldLight.position.set(14, -10, 4);
    scene.add(emeraldLight);

    // Soft Sky-Blue Accent Glow
    const blueAccentLight = new THREE.PointLight(0x38bdf8, 1.0, 30);
    blueAccentLight.position.set(-12, 10, 6);
    scene.add(blueAccentLight);

    // 3. Floating Rounded Frosted Glass Panels
    const glassGroup = new THREE.Group();
    scene.add(glassGroup);

    // Frosted glass material: high roughness (no harsh glossy highlights), translucent opacity
    const frostedMaterial = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        roughness: 0.65,      // Matte frosted finish
        metalness: 0.05,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide
    });

    const glassPanelData = [
        { width: 5.2, height: 7.2, depth: 0.1, x: 5.5, y: 1.2, z: -2, rotX: -0.18, rotY: 0.22, rotZ: 0.05, floatSpeed: 0.3, phase: 0 },
        { width: 6.0, height: 8.5, depth: 0.1, x: -6.0, y: -2.0, z: -5, rotX: 0.15, rotY: -0.25, rotZ: -0.08, floatSpeed: 0.25, phase: 1.5 },
        { width: 4.0, height: 5.5, depth: 0.1, x: 7.0, y: -4.5, z: -7, rotX: 0.2, rotY: 0.12, rotZ: 0.1, floatSpeed: 0.35, phase: 3.0 },
        { width: 3.5, height: 4.8, depth: 0.1, x: -4.2, y: 4.0, z: -3, rotX: -0.12, rotY: 0.18, rotZ: -0.04, floatSpeed: 0.28, phase: 4.5 }
    ];

    const glassPanels = [];

    glassPanelData.forEach(d => {
        const geom = new THREE.BoxGeometry(d.width, d.height, d.depth);
        const panel = new THREE.Mesh(geom, frostedMaterial);
        
        panel.position.set(d.x, d.y, d.z);
        panel.rotation.set(d.rotX, d.rotY, d.rotZ);

        panel.userData = {
            baseX: d.x,
            baseY: d.y,
            baseZ: d.z,
            rotX: d.rotX,
            rotY: d.rotY,
            rotZ: d.rotZ,
            floatSpeed: d.floatSpeed,
            phase: d.phase
        };

        glassGroup.add(panel);
        glassPanels.push(panel);
    });

    // 4. Thin Navy-Blue Blueprint Architectural Lines (Far Background)
    const blueprintGroup = new THREE.Group();
    blueprintGroup.position.set(0, 0, -12);
    scene.add(blueprintGroup);

    const navyLineMat = new THREE.LineBasicMaterial({
        color: 0x1e3a8a,      // Deep navy blue
        transparent: true,
        opacity: 0.09        // Barely visible architectural stroke
    });

    // Blueprint Shape 1: Large subtle polygon grid stroke
    const geom1 = new THREE.BufferGeometry();
    const pts1 = new Float32Array([
        -18, 10, 0,   12, 14, 0,
         12, 14, 0,   18, -8, 0,
         18, -8, 0,  -10, -12, 0,
        -10, -12, 0, -18, 10, 0
    ]);
    geom1.setAttribute('position', new THREE.BufferAttribute(pts1, 3));
    const bpLine1 = new THREE.LineSegments(geom1, navyLineMat);
    blueprintGroup.add(bpLine1);

    // Blueprint Shape 2: Tilted inner architectural crosshair
    const geom2 = new THREE.BufferGeometry();
    const pts2 = new Float32Array([
        -8, -14, 0,   16, 8, 0,
        -14, 6, 0,    10, -10, 0
    ]);
    geom2.setAttribute('position', new THREE.BufferAttribute(pts2, 3));
    const bpLine2 = new THREE.LineSegments(geom2, navyLineMat);
    blueprintGroup.add(bpLine2);

    // 5. Fine Soft Ambient Speckles
    const dustCount = 250;
    const dustGeom = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 50;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
    }

    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0x94a3b8,
        size: 0.035,
        transparent: true,
        opacity: 0.25
    });

    const dustSystem = new THREE.Points(dustGeom, dustMat);
    scene.add(dustSystem);

    // 6. Smooth Mouse & Scroll Mechanics (Low-contrast, gentle inertia)
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let scrollY = 0;
    let targetScrollY = 0;

    window.addEventListener("mousemove", (e) => {
        targetMouseX = (e.clientX / window.innerWidth - 0.5) * 1.5;
        targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 1.5;
    });

    window.addEventListener("scroll", () => {
        targetScrollY = window.scrollY;
    });

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 7. Animation Loop (Slow, calm, spacious editorial floating)
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Very slow lerp for editorial feel
        mouseX += (targetMouseX - mouseX) * 0.015;
        mouseY += (targetMouseY - mouseY) * 0.015;

        scrollY += (targetScrollY - scrollY) * 0.04;
        const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
        const scrollPercent = Math.min(1, Math.max(0, scrollY / maxScroll));

        // Floating Frosted Glass Panels Motion
        glassPanels.forEach(p => {
            const ud = p.userData;
            // Gentle multi-axis floating
            p.position.y = ud.baseY + Math.sin(elapsedTime * ud.floatSpeed + ud.phase) * 0.35;
            p.position.x = ud.baseX + Math.cos(elapsedTime * ud.floatSpeed * 0.7 + ud.phase) * 0.15;
            
            p.rotation.x = ud.rotX + Math.sin(elapsedTime * 0.2 + ud.phase) * 0.03;
            p.rotation.y = ud.rotY + Math.cos(elapsedTime * 0.25 + ud.phase) * 0.04;
        });

        // Blueprint background slow drift
        blueprintGroup.rotation.z = Math.sin(elapsedTime * 0.05) * 0.02;

        // Camera Soft Movement
        camera.position.x = mouseX * 0.8;
        camera.position.y = -scrollPercent * 3 - mouseY * 0.6;
        camera.lookAt(0, camera.position.y, 0);

        renderer.render(scene, camera);
    }

    animate();
})();
