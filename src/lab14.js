import { createProgram } from "./webgl-utils.js";
import { parseOBJ, parseOBJWithNormals } from "./obj-loader.js";
import { mat4, vec3, glMatrix } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/+esm";

class Camera {
    constructor(position = [0.0, 0.0, 0.0], up = [0.0, 1.0, 0.0], yaw = -90.0, pitch = 0.0) {
        // Camera Attributes
        this.position = vec3.clone(position);
        this.front = vec3.fromValues(0.0, 0.0, -1.0);
        this.worldUp = vec3.clone(up);
        this.up = vec3.create();
        this.right = vec3.create();

        // Euler Angles
        this.yaw = yaw;
        this.pitch = pitch;

        // Camera Options
        this.movementSpeed = 2.5;
        this.mouseSensitivity = 0.1;
        this.zoom = 45.0;

        this.updateCameraVectors();
    }

    // Returns the view matrix calculated using Euler angles and the LookAt matrix
    getViewMatrix() {
        let target = vec3.create();
        vec3.add(target, this.position, this.front); // target = position + front
        return mat4.lookAt(mat4.create(), this.position, target, this.up);
    }

    // Processes keyboard input
    processKeyboard(direction, deltaTime) {
        let velocity = this.movementSpeed * deltaTime;
        let movement = vec3.create();

        if (direction === 'FORWARD') vec3.scaleAndAdd(movement, movement, this.front, velocity);
        if (direction === 'BACKWARD') vec3.scaleAndAdd(movement, movement, this.front, -velocity);
        if (direction === 'LEFT') vec3.scaleAndAdd(movement, movement, this.right, -velocity);
        if (direction === 'RIGHT') vec3.scaleAndAdd(movement, movement, this.right, velocity);
        if (direction === 'UP') vec3.scaleAndAdd(movement, movement, this.up, velocity);
        if (direction === 'DOWN') vec3.scaleAndAdd(movement, movement, this.up, -velocity);

        vec3.add(this.position, this.position, movement);

        // Rotation
        const rotationSpeed = 20.0;
        if (direction === 'ROTATE_LEFT') this.yaw -= rotationSpeed * deltaTime;
        if (direction === 'ROTATE_RIGHT') this.yaw += rotationSpeed * deltaTime;

        this.updateCameraVectors();
    }

    // Processes mouse movement input
    processMouseMovement(xoffset, yoffset, constrainPitch = true) {
        xoffset *= this.mouseSensitivity;
        yoffset *= this.mouseSensitivity;

        this.yaw += xoffset;
        this.pitch += yoffset;

        // Constrain pitch to avoid screen flipping
        if (constrainPitch) {
            this.pitch = Math.min(Math.max(this.pitch, -89.0), 89.0);
        }

        this.updateCameraVectors();
    }

    // Processes mouse scroll input
    processMouseScroll(yoffset) {
        this.zoom -= yoffset;
        this.zoom = Math.min(Math.max(this.zoom, 1.0), 45.0);
    }

    // Updates the camera's Front, Right, and Up vectors using Euler Angles
    updateCameraVectors() {
        const front = vec3.create();
        front[0] = Math.cos(glMatrix.toRadian(this.yaw)) * Math.cos(glMatrix.toRadian(this.pitch));
        front[1] = Math.sin(glMatrix.toRadian(this.pitch));
        front[2] = Math.sin(glMatrix.toRadian(this.yaw)) * Math.cos(glMatrix.toRadian(this.pitch));
        vec3.normalize(this.front, front);

        // Recalculate Right and Up vectors
        vec3.cross(this.right, this.front, this.worldUp);
        vec3.normalize(this.right, this.right);

        vec3.cross(this.up, this.right, this.front);
        vec3.normalize(this.up, this.up);
    }
}

export class Object3D {
    constructor(gl, program, objData, textureUrl, scale) {
        this.gl = gl;
        this.program = program;

        const { positions, texCoords, normals } = parseOBJWithNormals(objData);

        for (let i = 0; i < positions.length; i++) {
            positions[i] *= scale;
        }

        this.vertexCount = positions.length / 3;

        // Create and bind VAO
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        // Create position buffer
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Create texture coordinate buffer
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

        this.vertexNormalsBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);

        // Load texture
        this.texture = gl.createTexture();
        const image = new Image();
        image.src = textureUrl;
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
        };
    }

    updateInstanceMatrices(matrices) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceMatrixBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.DYNAMIC_DRAW);
    }

    renderInstanced(instanceCount, viewMatrix) {
        const gl = this.gl;

        gl.useProgram(this.program);

        // Set the uniform matrix explicitly
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uMatrix"), false, viewMatrix);

        gl.bindVertexArray(this.vao);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, this.vertexCount, instanceCount);

        gl.bindVertexArray(null);
    }

    // render(matrix) {
    //     const gl = this.gl;

    //     gl.useProgram(this.program);
    //     gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uMatrix"), false, matrix);

    //     gl.bindVertexArray(this.vao);
    //     gl.bindTexture(gl.TEXTURE_2D, this.texture);
    //     gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);

    //     gl.bindVertexArray(null);
    // }
    render(model, view, projection, shadingMode) {
        const gl = this.gl;

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uModelMatrix"), false, model);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uViewMatrix"), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uProjectionMatrix"), false, projection);

        // Get uniform locations for light structs
        const pointLightLoc = {
            position: gl.getUniformLocation(this.program, "uPointLight.position"),
            color: gl.getUniformLocation(this.program, "uPointLight.color"),
            intensity: gl.getUniformLocation(this.program, "uPointLight.intensity"),
            attenuation: gl.getUniformLocation(this.program, "uPointLight.attenuation")
        };

        const dirLightLoc = {
            direction: gl.getUniformLocation(this.program, "uDirLight.direction"),
            color: gl.getUniformLocation(this.program, "uDirLight.color"),
            intensity: gl.getUniformLocation(this.program, "uDirLight.intensity"),
        };

        const spotLightLoc = {
            position: gl.getUniformLocation(this.program, "uSpotLight.position"),
            direction: gl.getUniformLocation(this.program, "uSpotLight.direction"),
            color: gl.getUniformLocation(this.program, "uSpotLight.color"),
            intensity: gl.getUniformLocation(this.program, "uSpotLight.intensity"),
            cutoff: gl.getUniformLocation(this.program, "uSpotLight.cutoff"),
        };


        // Set values for Point Light
        gl.uniform3fv(pointLightLoc.position, pointLightPosition);  // Position
        gl.uniform3fv(pointLightLoc.color, [0.0, 1.0, 1.0]);     // Color
        gl.uniform1f(pointLightLoc.intensity, pointLightIntensity);              // Intensity
        gl.uniform3fv(pointLightLoc.attenuation, [1.0, 0.09, 0.032]); // Attenuation

        // Set values for Directional Light
        gl.uniform3fv(dirLightLoc.direction, dirLightDirection); // Direction
        gl.uniform3fv(dirLightLoc.color, [0.7, 0.0, 0.0]);        // Color
        gl.uniform1f(dirLightLoc.intensity, dirLightIntensity);                 // Intensity

        // Set values for Spotlight
        gl.uniform3fv(spotLightLoc.position, camera.position); // Spotlight originates from the camera's position
        gl.uniform3fv(spotLightLoc.direction, camera.front);  // Spotlight points in the camera's front direction

        gl.uniform3fv(spotLightLoc.color, [1.0, 0.0, 1.0]);       // Color
        gl.uniform1f(spotLightLoc.intensity, spotLightIntensity);                // Intensity
        gl.uniform1f(spotLightLoc.cutoff, spotLightCutoff); // Spotlight cutoff (30 degrees)

        gl.uniform1i(gl.getUniformLocation(this.program, "uShadingMode"), shadingMode);

        gl.uniform3fv(gl.getUniformLocation(this.program, "uViewPos"), camera.position);

        gl.uniform1f(gl.getUniformLocation(this.program, "uRoughness"), 0.5);
        gl.uniform1f(gl.getUniformLocation(this.program, "uShininess"), 32);


        gl.bindVertexArray(this.vao);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);

        gl.bindVertexArray(null);
    }
}

document.addEventListener("click", function () {
    document.body.requestPointerLock();
});

const camera = new Camera([0.0, 0.0, 5.0]);

var pointLightPosition = [1.0, 2.0, 3.0];
var pointLightIntensity = 1.5;
var dirLightIntensity = 0.8;
var spotLightIntensity = 2.0;
var dirLightDirection = [-0.5, -1.0, -0.5];
var spotLightCutoff = Math.cos(Math.PI / 24);


(async () => {
    function resizeCanvasToDisplaySize(canvas) {
        const realToCSSPixels = window.devicePixelRatio || 1;

        const displayWidth = Math.floor(canvas.clientWidth * realToCSSPixels);
        const displayHeight = Math.floor(canvas.clientHeight * realToCSSPixels);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
    }

    const canvas = document.getElementById("gl-canvas");
    /** @type {WebGL2RenderingContext} */
    const gl = canvas.getContext("webgl2");

    // Position at (0, 0, 5)
    const projectionMatrix = mat4.create(); // For perspective projection
    const modelMatrix = mat4.create();
    //mat4.identity(modelMatrix, modelMatrix);

    mat4.perspective(
        projectionMatrix,
        Math.PI / 4, // 45 degrees field of view
        canvas.width / canvas.height, // Aspect ratio
        0.1, // Near plane
        100.0 // Far plane
    );

    const keys = {};
    window.addEventListener("keydown", (e) => {
        keys[e.key] = true;
    });
    window.addEventListener("keyup", (e) => {
        keys[e.key] = false;
    });

    function clamp(value, change) {
        if (value + change > 0) {
            return value + change
        }
        else {
            return 0;
        }
    }


    var mode = false;

    function update(deltaTime) {
        if (keys["w"]) camera.processKeyboard("FORWARD", deltaTime);
        if (keys["s"]) camera.processKeyboard("BACKWARD", deltaTime);
        if (keys["a"]) camera.processKeyboard("LEFT", deltaTime);
        if (keys["d"]) camera.processKeyboard("RIGHT", deltaTime);
        if (keys["q"]) camera.processKeyboard("UP", deltaTime);
        if (keys["e"]) camera.processKeyboard("DOWN", deltaTime);

        if (keys["ArrowLeft"]) pointLightIntensity = clamp(pointLightIntensity,-deltaTime);
        if (keys["ArrowRight"]) pointLightIntensity = clamp(pointLightIntensity, deltaTime);

        if (keys["ArrowUp"]) dirLightIntensity = clamp(dirLightIntensity, deltaTime);
        if (keys["ArrowDown"]) dirLightIntensity = clamp(dirLightIntensity, -deltaTime);

        if (keys["1"]) spotLightIntensity = clamp(spotLightIntensity, -deltaTime);
        if (keys["3"]) spotLightIntensity = clamp(spotLightIntensity, deltaTime);

        if (keys["+"]) spotLightCutoff -= 0.1*deltaTime;
        if (keys["-"]) spotLightCutoff += 0.1*deltaTime;

        let front = vec3.fromValues(0, 0, 1);
        let up = vec3.fromValues(0, 1, 0);
        let right = vec3.fromValues(1, 0, 0);

        let velocity = 1.0 * deltaTime;
        let movement = vec3.create();

        if (keys["i"]) mode=true;
        if (keys["o"]) mode=false;

        if (keys["8"]) vec3.scaleAndAdd(movement, movement, front, velocity);
        if (keys["5"]) vec3.scaleAndAdd(movement, movement, front, -velocity);
        if (keys["4"]) vec3.scaleAndAdd(movement, movement, right, -velocity);
        if (keys["6"]) vec3.scaleAndAdd(movement, movement, right, velocity);
        if (keys["9"]) vec3.scaleAndAdd(movement, movement, up, velocity);
        if (keys["7"]) vec3.scaleAndAdd(movement, movement, up, -velocity);

        
        if (mode) {
            vec3.add(pointLightPosition, pointLightPosition, movement);
        } else {
            vec3.add(dirLightDirection, dirLightDirection, movement);
        }

        //console.log(1, dirLightDirection)
        //console.log(2, pointLightPosition)
    }

    document.body.addEventListener("mousemove", function (event) {
        camera.processMouseMovement(event.movementX, -event.movementY);
    });

    if (!gl) {
        console.error("WebGL2 not supported.");
        return;
    }

    resizeCanvasToDisplaySize(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vertexShaderSource = `#version 300 es
    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec2 aTexCoord;
    layout(location = 2) in vec3 aNormal;

    uniform mat4 uModelMatrix, uViewMatrix, uProjectionMatrix;
    uniform vec3 uViewPos;

    out vec3 vNormal;
    out vec3 vFragPos;
    out vec2 vTexCoord;
    out vec3 viewDir;

    void main() {
        vNormal = normalize(mat3(transpose(inverse(uModelMatrix))) * aNormal);
        vFragPos = vec3(uModelMatrix * vec4(aPosition, 1.0));
        viewDir = normalize(uViewPos - vFragPos);
        vTexCoord = aTexCoord;
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
    }`;


    const fragmentShaderSource = `#version 300 es
    precision mediump float;

    in vec3 vNormal;
    in vec3 vFragPos;
    in vec2 vTexCoord;
    in vec3 viewDir;

    struct Light {
        vec3 position;
        vec3 direction;
        vec3 color;
        vec3 attenuation; // For point lights
        float intensity;
        float cutoff; // For spotlights
    };
    uniform Light uPointLight;
    uniform Light uDirLight;
    uniform Light uSpotLight;

    uniform sampler2D uTexture;

    uniform int uShadingMode;

    uniform float uShininess;

    uniform float uRoughness;

    out vec4 FragColor;

    vec3 phongShading(vec3 lightDir, vec3 normal, vec3 lightColor, float intensity, float attenuation) {
        vec3 ambient = 0.1 * lightColor;

        float NdotL = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = lightColor * NdotL * intensity;

        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
        vec3 specular = lightColor * spec * intensity;

        return ambient + diffuse * attenuation + specular * attenuation;
    }

    float toonShade(vec3 normal, vec3 lightDir) {
        float intensity = max(dot(normal, lightDir), 0.0);
        if (intensity > 0.9) return 1.0;
        else if (intensity > 0.5) return 0.7;
        else if (intensity > 0.25) return 0.4;
        else return 0.2;
    }

    vec3 orenNayarShade(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 lightColor, float intensity, float roughness) {
        float sigma2 = roughness * roughness;
        float A = 1.0 - 0.5 * (sigma2 / (sigma2 + 0.33));
        float B = 0.45 * (sigma2 / (sigma2 + 0.09));

        float NdotL = max(dot(normal, lightDir), 0.0);
        float NdotV = max(dot(normal, viewDir), 0.0);

        vec3 H = normalize(lightDir + viewDir);
        float gamma = max(dot(lightDir - normal * NdotL, viewDir - normal * NdotV), 0.0);

        float theta_r = acos(NdotV);
        float theta_i = acos(NdotL);

        float alpha = max(theta_r, theta_i);
        float beta = min(theta_r, theta_i);

        float diffuse = A + B * gamma * sin(alpha) * tan(beta);
        return lightColor * NdotL * intensity * diffuse;
    }

    vec3 spotlightEffect(vec3 lightDir, vec3 normal, vec3 lightColor, float intensity, float cutoff) {
        float theta = dot(lightDir, normalize(-uSpotLight.direction));
        if (theta > cutoff) {
            float diff = max(dot(normal, lightDir), 0.0);
            return lightColor * diff * intensity;
        }
        return vec3(0.0);
    }

    void main() {
        vec4 texColor = texture(uTexture, vTexCoord);
        vec3 resultColor = vec3(0.0);

        vec3 normal = normalize(vNormal);

        // Point Light
        vec3 lightDir = normalize(uPointLight.position - vFragPos);
        float len = length(lightDir);
        float attenuation = 1.0 / (uPointLight.attenuation[0] + uPointLight.attenuation[1] * len + uPointLight.attenuation[2] * len * len);

        // Directional Light
        vec3 dirLightDir = normalize(-uDirLight.direction);

        // Spotlight
        vec3 spotLightDir = normalize(uSpotLight.position - vFragPos);
        len = length(spotLightDir);

        if (uShadingMode == 0) {
            // Phong shading
            resultColor += phongShading(lightDir, normal, uPointLight.color, uPointLight.intensity, attenuation);
            resultColor += phongShading(dirLightDir, normal, uDirLight.color, uDirLight.intensity, 1.0);

            vec3 spotlightColor = spotlightEffect(spotLightDir, normal, uSpotLight.color, uSpotLight.intensity, uSpotLight.cutoff);
            resultColor += spotlightColor;
        } else if (uShadingMode == 1) {
            // Toon shading
            float toon = toonShade(normal, lightDir);
            resultColor += uPointLight.color * toon * uPointLight.intensity;
            resultColor += uDirLight.color * toonShade(normal, dirLightDir) * uDirLight.intensity;
            resultColor += uSpotLight.color * toonShade(normal, spotLightDir) * uSpotLight.intensity * (dot(spotLightDir, -uSpotLight.direction) > uSpotLight.cutoff ? 1.0 : 0.0);
        } else if (uShadingMode == 2) {
            // Oren-Nayar shading
            resultColor += orenNayarShade(lightDir, viewDir, normal, uPointLight.color, uPointLight.intensity, uRoughness) * attenuation;
            resultColor += orenNayarShade(dirLightDir, viewDir, normal, uDirLight.color, uDirLight.intensity, uRoughness);
            resultColor += orenNayarShade(spotLightDir, viewDir, normal, uSpotLight.color, uSpotLight.intensity, uRoughness) * spotlightEffect(spotLightDir, normal, vec3(1.0), 1.0, uSpotLight.cutoff).x;
        }

        FragColor = vec4(resultColor * texColor.rgb, texColor.a);
    }
    `;

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // Load the cat model
    const kowalskiResponse = await fetch("../models/cat.obj");
    const kowalskiObjData = await kowalskiResponse.text();
    const kowalski = new Object3D(gl, program, kowalskiObjData, "../images/texture.png", 3);
    const privateResponse = await fetch("../models/Private.obj");
    const privateObjData = await privateResponse.text();
    const private_ = new Object3D(gl, program, privateObjData, "../images/Private.png", 0.2);

    const ricoResponse = await fetch("../models/cat.obj");
    const ricoObjData = await ricoResponse.text();
    const rico = new Object3D(gl, program, ricoObjData, "../images/texture.png", 3);

    const skipperResponse = await fetch("../models/cat.obj");
    const skipperObjData = await skipperResponse.text();
    const skipper = new Object3D(gl, program, skipperObjData, "../images/texture.png", 3);

    const mauriceResponse = await fetch("../models/Maurice.obj");
    const mauriceObjData = await mauriceResponse.text();
    const maurice = new Object3D(gl, program, mauriceObjData, "../images/Maurice.png", 0.2);

    const julienResponse = await fetch("../models/Julien.obj");
    const julienObjData = await julienResponse.text();
    const julien = new Object3D(gl, program, julienObjData, "../images/JulienMaster.png", 0.2);

    const mortResponse = await fetch("../models/Mort.obj");
    const mortObjData = await mortResponse.text();
    const mort = new Object3D(gl, program, mortObjData, "../images/Mort.png", 0.2);


    var modelMatrices = [];
    for (let index = 0; index < 7; index++) {
        modelMatrices.push(mat4.create());
        mat4.translate(modelMatrices[index], modelMatrix, [index * 2, 0, 0]);
    }

    function render() {
        resizeCanvasToDisplaySize(canvas);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        const now = Date.now() / 1000.0;

        const deltaTime = 0.016; // Approximate for simplicity
        update(deltaTime); // Update camera position

        const viewMatrix = camera.getViewMatrix(); // Get updated view matrix

        for (let index = 0; index < modelMatrices.length; index++) {
            mat4.rotateY(modelMatrices[index], modelMatrices[index], 0.01)
        }

        private_.render(modelMatrices[0], viewMatrix, projectionMatrix, 0);

        skipper.render(modelMatrices[1], viewMatrix, projectionMatrix, 1);

        kowalski.render(modelMatrices[2], viewMatrix, projectionMatrix, 2);


        mort.render(modelMatrices[4], viewMatrix, projectionMatrix, 1)

        julien.render(modelMatrices[5], viewMatrix, projectionMatrix, 1)

        maurice.render(modelMatrices[6], viewMatrix, projectionMatrix, 2)

        rico.render(modelMatrices[3], viewMatrix, projectionMatrix, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        //gl.depthMask(false);
        //gl.depthMask(true);

        requestAnimationFrame(render);
    }

    render();
})();
