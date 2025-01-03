"use strict";
var lab11;
(function (lab11) {
    let selectFigure = null;
    let selectPaintMode = null;
    let gl = null;
    let program = null;
    let attrib_vertex = null;
    let vertexColorAttribute = null;
    let VBO = null;
    let color_buffer = null;
    let uniformColor = null;
    const vertexShaderSource1 = `#version 300 es
in vec2 coord;
void main() {
  gl_Position = vec4(coord, 0.0, 1.0);
}
`;
    const fragmentShaderSource1 = `#version 300 es
precision highp float;
out vec4 color;
void main() {
  color = vec4(0, 1, 0, 1);
}
`;
    const vertexShaderSource2 = `#version 300 es
in vec2 coord;
void main() {
  gl_Position = vec4(coord, 0.0, 1.0);
}
`;
    const fragmentShaderSource2 = `#version 300 es
precision highp float;
uniform vec4 uniformColor;
out vec4 color;
void main() {
  color = uniformColor;
}
`;
    const vertexShaderSource3 = `#version 300 es
precision highp float;
in vec2 coord;
in vec4 a_color;
out vec4 v_color;

void main() {
  gl_Position = vec4(coord, 0.0, 1.0);
  v_color = a_color;
}
`;
    const fragmentShaderSource3 = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 color;

void main() {
  color = v_color;
}
`;
    const cube = [
        -0.7, -0.1,
        -0.4, 0.5,
        0.4, -0.5,
        0.7, 0.1,
    ];
    const fan = [
        0.0, -0.8,
        -0.8, 0.4,
        -0.5, 0.6,
        0.0, 0.8,
        0.5, 0.6,
        0.8, 0.4,
    ];
    const pentagon = [
        0.0, 1.0,
        0.951, 0.309,
        0.588, -0.809,
        -0.588, -0.809,
        -0.951, 0.309,
    ];
    let vertexShaderSource = vertexShaderSource1;
    let fragmentShaderSource = fragmentShaderSource1;
    let vertices = cube;
    let primitive = WebGL2RenderingContext.TRIANGLE_STRIP;
    function init() {
        initShaders();
        initVBO(vertices);
    }
    function initVBO(vertices) {
        if (!gl)
            return;
        VBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        if (selectPaintMode === null || selectPaintMode === void 0 ? void 0 : selectPaintMode.options[2].selected) {
            color_buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
            const colors = [
                1.0, 0.0, 0.0, 1.0, // красный
                1.0, 1.0, 0.0, 1.0, // жёлтый
                0.0, 1.0, 0.0, 1.0, // зелёный
                0.0, 1.0, 1.0, 1.0,
                0.0, 0.0, 1.0, 1.0, // синий
                1.0, 0.0, 1.0, 1.0, // фиолетовый
            ];
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
        }
    }
    function initShaders() {
        if (!gl)
            return;
        const vertexShader = getShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = getShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        program = gl.createProgram();
        if (!program)
            return;
        if (!vertexShader)
            return;
        if (!fragmentShader)
            return;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Не удалось установить шейдеры");
            return;
        }
        attrib_vertex = gl.getAttribLocation(program, "coord");
        if (attrib_vertex === -1) {
            console.error("Не получилось связать атрибут");
            return;
        }
        if (selectPaintMode === null || selectPaintMode === void 0 ? void 0 : selectPaintMode.options[2].selected) {
            vertexColorAttribute = gl.getAttribLocation(program, "a_color");
            if (vertexColorAttribute === -1) {
                console.error("Не получилось связать атрибут");
                return;
            }
        }
        if (selectPaintMode === null || selectPaintMode === void 0 ? void 0 : selectPaintMode.options[1].selected) {
            uniformColor = gl.getUniformLocation(program, "uniformColor");
            if (!uniformColor) {
                console.error("Не удалось получить uniform-переменную 'uniformColor'");
            }
        }
    }
    function getShader(gl, type, source) {
        const shader = gl.createShader(type);
        if (!shader)
            return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Ошибка компиляции шейдера: ", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
    function draw() {
        if (!gl || !program || attrib_vertex === null)
            return;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.enableVertexAttribArray(attrib_vertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
        gl.vertexAttribPointer(attrib_vertex, 2, gl.FLOAT, false, 0, 0);
        if ((selectPaintMode === null || selectPaintMode === void 0 ? void 0 : selectPaintMode.options[1].selected) && uniformColor) {
            gl.uniform4f(uniformColor, 0.5, 0.0, 0.5, 1.0);
        }
        if ((selectPaintMode === null || selectPaintMode === void 0 ? void 0 : selectPaintMode.options[2].selected) && vertexColorAttribute !== null) {
            gl.enableVertexAttribArray(vertexColorAttribute);
            gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
            gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);
        }
        gl.drawArrays(primitive, 0, vertices.length / 2);
        gl.disableVertexAttribArray(attrib_vertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    function main() {
        const canvas = document.getElementById("canvasWebGL");
        gl = canvas === null || canvas === void 0 ? void 0 : canvas.getContext("webgl2");
        selectFigure = document.querySelector('#figure');
        if (gl == null) {
            console.error("Ваш браузер не поддерживает WebGL");
            return;
        }
        if (selectFigure == null)
            return;
        selectFigure.addEventListener('change', function () {
            if (!gl)
                return;
            if ((selectFigure === null || selectFigure === void 0 ? void 0 : selectFigure.options[0].selected) === true) {
                vertices = cube;
                primitive = gl.TRIANGLE_STRIP;
            }
            else if ((selectFigure === null || selectFigure === void 0 ? void 0 : selectFigure.options[1].selected) === true) {
                vertices = fan;
                primitive = gl.TRIANGLE_FAN;
            }
            else {
                vertices = pentagon;
                primitive = gl.TRIANGLE_FAN;
            }
            init();
            draw();
        });
        selectPaintMode = document.querySelector('#paintMode');
        if (!selectPaintMode)
            return;
        selectPaintMode.addEventListener('change', function () {
            if ((selectPaintMode === null || selectPaintMode === void 0 ? void 0 : selectPaintMode.options[0].selected) === true) {
                vertexShaderSource = vertexShaderSource1;
                fragmentShaderSource = fragmentShaderSource1;
            }
            else if ((selectPaintMode === null || selectPaintMode === void 0 ? void 0 : selectPaintMode.options[1].selected) === true) {
                vertexShaderSource = vertexShaderSource2;
                fragmentShaderSource = fragmentShaderSource2;
            }
            else {
                vertexShaderSource = vertexShaderSource3;
                fragmentShaderSource = fragmentShaderSource3;
            }
            init();
            draw();
        });
        init();
        draw();
    }
    window.onload = main;
})(lab11 || (lab11 = {}));
