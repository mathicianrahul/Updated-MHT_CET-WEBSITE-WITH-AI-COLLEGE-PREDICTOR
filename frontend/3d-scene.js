/* ==========================================================================
   EXPANDED $1M LUXURY 3D WEBGL ENGINE - AIMLRAHULCOUNSELLING
   Full-Page Expanded Organic Wave Matrix, Dynamic Scroll Flow & Ambient Stardust
   ========================================================================== */

(function initExpandedLuxury3DEngine() {
    const canvas = document.getElementById("webgl-canvas");
    if (!canvas) return;

    // Detect Current Page
    const path = window.location.pathname.toLowerCase();
    const isServicesPage = path.includes("viewservices.html");
    const isConsultationPage = path.includes("consultationform.html") || path.includes("consultation.html");
    const isAuthPage = path.includes("login.html") || path.includes("register.html");

    // 1. Scene, Camera & Renderer Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.008); // Ultra-light fog to expand 3D depth view

    const camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, -4, 22);

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // 2. $1M Luxury Expanded Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const cursorLight = new THREE.PointLight(0x2563eb, 3.5, 50);
    cursorLight.position.set(0, 0, 10);
    scene.add(cursorLight);

    const emeraldLight = new THREE.PointLight(0x10b981, 3.0, 45);
    emeraldLight.position.set(16, -10, 6);
    scene.add(emeraldLight);

    const skyLight = new THREE.PointLight(0x0284c7, 2.5, 45);
    skyLight.position.set(-16, 10, 4);
    scene.add(skyLight);

    // 3. Expanded Full-Page Organic 3D Wave Matrix
    const planeWidth = 115;
    const planeHeight = 75;
    const segmentsX = 120;
    const segmentsY = 85;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);
    const posAttr = geometry.attributes.position;
    const originalZ = new Float32Array(posAttr.count);

    for (let i = 0; i < posAttr.count; i++) {
        originalZ[i] = posAttr.getZ(i);
    }

    const wireframeMat = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        wireframe: true,
        transparent: true,
        opacity: 0.20,
        roughness: 0.15,
        metalness: 0.75
    });

    const meshPlane = new THREE.Mesh(geometry, wireframeMat);
    meshPlane.rotation.x = -1.15;
    meshPlane.position.set(0, -6, -2);
    scene.add(meshPlane);

    // Glowing Vertex Points Layer
    const pointsMat = new THREE.PointsMaterial({
        color: 0x10b981,
        size: 0.055,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    const pointsMesh = new THREE.Points(geometry, pointsMat);
    pointsMesh.rotation.x = meshPlane.rotation.x;
    pointsMesh.position.copy(meshPlane.position);
    scene.add(pointsMesh);

    // 4. Expanded Zero-G Stardust Field (1,200 Particles)
    const starCount = 1200;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * 70;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 60;
        starPositions[i * 3 + 2] = (Math.random() - 0.5) * 24 - 3;
    }

    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starField = new THREE.Points(
        starGeom,
        new THREE.PointsMaterial({
            color: 0x38bdf8,
            size: 0.05,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        })
    );
    scene.add(starField);

    // 5. Mouse Interaction & Scroll Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let targetScrollY = 0;
    let scrollY = 0;

    const cursorGlow = document.getElementById("cursor-glow");

    window.addEventListener("mousemove", (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;

        if (cursorGlow) {
            cursorGlow.style.left = e.clientX + "px";
            cursorGlow.style.top = e.clientY + "px";
        }
    });

    window.addEventListener("scroll", () => {
        targetScrollY = window.scrollY;
    });

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 6. Animation Loop
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        targetX += (mouseX - targetX) * 0.04;
        targetY += (mouseY - targetY) * 0.04;

        scrollY += (targetScrollY - scrollY) * 0.06;
        const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
        const scrollPercent = Math.min(1, Math.max(0, scrollY / maxScroll));

        // Light follow mouse & scroll
        cursorLight.position.x = targetX * 16;
        cursorLight.position.y = targetY * 10 - (scrollPercent * 14);

        // Expanded Wave Synthesis Math
        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);

            const wave1 = Math.sin(vx * 0.15 + elapsedTime * 1.3) * Math.cos(vy * 0.15 + elapsedTime * 1.0) * 0.85;
            const wave2 = Math.sin(vx * 0.06 - elapsedTime * 0.7) * Math.sin(vy * 0.08 + elapsedTime * 0.5) * 0.55;

            const dx = vx - targetX * 12;
            const dy = vy - targetY * 9;
            const dist = Math.hypot(dx, dy);
            const ripple = dist < 9 ? Math.cos(dist * 0.5 - elapsedTime * 3.2) * (9 - dist) * 0.15 : 0;

            posAttr.setZ(i, originalZ[i] + wave1 + wave2 + ripple);
        }
        posAttr.needsUpdate = true;
        meshPlane.geometry.computeVertexNormals();

        // Stardust upward drift
        const starPos = starField.geometry.attributes.position.array;
        for (let i = 0; i < starCount; i++) {
            starPos[i * 3 + 1] += 0.006;
            if (starPos[i * 3 + 1] > 30) starPos[i * 3 + 1] = -30;
        }
        starField.geometry.attributes.position.needsUpdate = true;

        // Expanded Camera Scroll Dynamics (Flowing across all sections down the page)
        camera.position.x = targetX * 1.6;
        camera.position.y = -4 - targetY * 1.2 - (scrollPercent * 16);
        camera.lookAt(new THREE.Vector3(0, camera.position.y + 3, 0));

        renderer.render(scene, camera);
    }

    animate();
})();
