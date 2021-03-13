//https://stackoverflow.com/questions/22570235/how-do-i-use-an-html5-canvas-as-a-webgl-texture
//https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html
//https://stackoverflow.com/questions/14607640/rotating-a-vector-in-3d-space

var vertexShaderText = `#version 300 es
    precision highp float;
    
    in vec2 vertPosition;
    in vec3 vertDirection;
    in vec2 vertTexCoord;

    out vec3 fragDir;
    out vec2 fragTexCoord;

    uniform vec2 u_resolution;
    uniform float u_minRes;
    uniform float u_angle;

    void main() {
        vec3 aspectRatio = vec3(u_resolution/u_minRes, 1.0);

        vec3 scaledDir = vertDirection * vec3(u_resolution/u_minRes, 1.0);
        vec2 rotatedDir = vec2(-1.0, 1.0) * scaledDir.zx * sin(u_angle) + scaledDir.xz * cos(u_angle);

        fragDir = vec3(rotatedDir.x, scaledDir.y, rotatedDir.y);
        gl_Position = vec4(vertPosition, 0.0, 1.0);
        fragTexCoord = vertTexCoord;
    }
`;

var fragShaderText = `#version 300 es
    precision highp float;
    in vec3 fragDir;
    in vec2 fragTexCoord;
    out vec4 fragColor;

    uniform vec2 u_resolution;
    uniform float u_pixelSize;
    uniform float u_numSamples;
    uniform sampler2D u_texture;
    uniform vec3 u_camPos;

    vec3 rayDir;
    vec3 rayPos;
    vec3 lastPos;
    float lastDist;
    float currDist;
    float col;
    bool finalGettingSmall;

    float seed;

    float dist(vec3 pos) {
        return min(length(pos)-1.0, distance(pos, vec3(0.8, 0.8, -0.7))-0.2);
    }

    float kindaRand(float x) {
        return mod(0.6180339887499 * (x + seed), 1.0);
        seed += x+1.0;
    }

    float veryRand(float x, float y) {
        return mod(sqrt(abs(x*y + seed))*100.0, 1.0);
        seed += 0.6180339887499;
    }

    float veryVeryRand(float x) {
        return veryRand(veryRand(kindaRand(x), seed), seed + 29.33);
    }

    void step() {
        lastDist = currDist;
        lastPos = rayPos;
        rayPos += rayDir * max(abs(lastDist), 0.01);
        currDist = dist(rayPos);
    }

    void march() {
        bool gettingSmall;
        for(int i = 0; (i < 50 && !gettingSmall); i++) {
            step();
            gettingSmall = currDist < min(0.0, lastDist);
        }

        if(gettingSmall) {
            rayPos = lastDist * (rayPos - lastPos) / (lastDist - currDist) + lastPos;
            currDist = dist(rayPos);
        }

        finalGettingSmall = gettingSmall;
    }

    void main() {
        seed = 15.9*u_numSamples + gl_FragCoord.x + u_resolution.x*gl_FragCoord.y;

        rayPos = u_camPos;
        
        vec2 randOffset = u_pixelSize * vec2(kindaRand(1.0), kindaRand(3.0));
        rayDir = normalize(fragDir + vec3(randOffset, 0.0));

        //first march to object
        lastDist = 10.0;
        march();

        
        if(dist(rayPos) <= lastDist && lastDist < 0.01) {//if touching the object, do all the ray calculations
            rayDir = normalize(vec3(-u_camPos.z, 2.0,-u_camPos.x) + .1*vec3(veryVeryRand(5.1), veryVeryRand(8.5), veryVeryRand(4.6)));
            march();
            col = float(!finalGettingSmall);
        } else {
            col = 0.0;
        }

        col = (col + u_numSamples * texture(u_texture, fragTexCoord).y) / (u_numSamples + 1.0);

        //col = texture(u_texture, fragTexCoord).x;

        fragColor = vec4(vec3(col), 1.0);
    }
`;

function getMousePos(canvas, evt) {
    var canvasStuff = canvas.getBoundingClientRect();
    return [
        evt.clientX - canvasStuff.left,
        canvasStuff.height - (evt.clientY - canvasStuff.top)
    ]
};

main();
var mouseDown = false;
document.body.onmousedown = function() { 
    mouseDown = true;
};
document.body.onmouseup = function() {
    mouseDown = false;
};
document.body.onmouseleave = function() {
    mouseDown = false;
};

function main() {
    const canvas = document.getElementById("idk");
    var mousePos = [0, 0];
    var prevMousePos = [0, 0];
    var angle = 0;
    
    const gl = canvas.getContext("webgl2", {preserveDrawingBuffer: true});
    if(!gl) {
        alert("bad!");
        return;
    }

    gl.clearColor(0.0, 0.7, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    //create shader
    {
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    
    gl.shaderSource(vertexShader, vertexShaderText);
    gl.shaderSource(fragmentShader, fragShaderText);
    }
    
    //compile shaders
    {
    gl.compileShader(vertexShader); //vertex shader
    if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(vertexShader));
        console.error("compile vertex shader bad :(", gl.getShaderInfoLog(vertexShader));
        return;
    } else { console.log("vertex shader compiled :)"); }
    gl.compileShader(fragmentShader);
    if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("compile frag shader bad :(", gl.getShaderInfoLog(fragmentShader));
        return
    } else {console.log("frag shader compiled :)");}
    }
    //create program
    {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert(gl.getProgramInfoLog(program));
        console.error("link program bad :(", gl.getProgramInfoLog(program));
        return;
    } else {console.log("program linked :)")}
    gl.validateProgram(program);
    if(!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        alert(gl.getProgramInfoLog(program));
        console.log("validate program bad :(", gl.getProgramInfoLog(program));
        return;
    }
    }
    
    //create buffer
    {
    var verticeData = [
        //x, y,     x, y, z     x, y
        -1, 1,      -1, 1, 1,   0, 0,
        -1, -1,     -1, -1, 1,  0, 1,
        1, -1,      1, -1, 1,   1, 1,
        1, 1,       1, 1, 1,    1, 0
    ];
    var indices = [
        0, 1, 2,
        0, 2, 3
    ];
    var vertDirections = [
        0, 0, 1,
        1, 0, 1,
        1, 1, 1,
        0, 1, 1
    ];
    
    var triangleVertexBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticeData), gl.STATIC_DRAW);
    
    var indexBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBufferObject);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    var positionAttribLocation = gl.getAttribLocation(program, "vertPosition");
    var directionAttribLocation = gl.getAttribLocation(program, "vertDirection");
    var textCoordAttributeLocation = gl.getAttribLocation(program, "vertTexCoord");
    gl.vertexAttribPointer(
        positionAttribLocation,
        2,
        gl.FLOAT,
        gl.FALSE,
        7 * Float32Array.BYTES_PER_ELEMENT,
        0
    );
    gl.vertexAttribPointer(
        directionAttribLocation,
        3,
        gl.FLOAT,
        gl.FALSE,
        7 * Float32Array.BYTES_PER_ELEMENT,
        2 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribPointer(
        textCoordAttributeLocation,
        2,
        gl.FLOAT,
        gl.FALSE,
        7 * Float32Array.BYTES_PER_ELEMENT,
        5 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.enableVertexAttribArray(directionAttribLocation);
    gl.enableVertexAttribArray(textCoordAttributeLocation);
    }

    gl.useProgram(program);

    
    //do texture stuff
    const targetTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    //size and format of texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    //set filtering stuff
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
   
    //uniform stuff
    {
    // uniform resolution
    var resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    // uniform minRes
    var minResUniformLocation = gl.getUniformLocation(program, "u_minRes");
    // uniform pixel size
    var pixelSizeUniformLocation = gl.getUniformLocation(program, "u_pixelSize");
    //uniform texture
    var texUniformLocation = gl.getUniformLocation(program, "u_texture");
    //uniform camPos
    var camPosUniformLocation = gl.getUniformLocation(program, "u_camPos");
    gl.uniform3fv(camPosUniformLocation, new Float32Array([0, 0, -3]));
    //uniform angle
    var angleUniformLocation = gl.getUniformLocation(program, "u_angle");
    }

    var minRes;
    var resizeCanvas = function(canvas) {
        if(canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth*1;
            canvas.height = canvas.clientHeight*1;

            var canvasResolution = new Float32Array([canvas.width, canvas.height]);
            gl.uniform2fv(resolutionUniformLocation, canvasResolution);

            minRes = Math.min(canvas.width, canvas.height);
            gl.uniform1f(minResUniformLocation, new Float32Array([minRes]));

            gl.uniform1f(pixelSizeUniformLocation, new Float32Array([1/minRes]));

            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            
            numSamples = 0;

            //set input texture to canvas
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.canvas);
        }
    };

    
    canvas.onmousemove = function(event) {
        prevMousePos[0] = mousePos[0];
        prevMousePos[1] = mousePos[1];
        mousePos = getMousePos(canvas, event);
        if(mouseDown) {
            angle += -0.01*(mousePos[0] - prevMousePos[0]);
            gl.uniform1f(angleUniformLocation, new Float32Array([angle]));
            var sin = 3*Math.sin(angle + Math.PI);
            var cos = 3*Math.cos(angle + Math.PI);
            gl.uniform3fv(camPosUniformLocation, new Float32Array([-sin, 0, cos]));
            numSamples = 0;
        }
    }

    //resizeCanvas(canvas);

    //uniform numSamples
    var numSamplesUniformLocation = gl.getUniformLocation(program, "u_numSamples");
    var numSamples = 0;
    
    var loop = function() {
        //resize canvas
        resizeCanvas(canvas);

        gl.uniform1f(numSamplesUniformLocation, new Float32Array([numSamples]));
        numSamples ++;
        
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

        //copy canvas to texture
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.canvas);
        
        //turn this on to update every frame
        requestAnimationFrame(loop);
    }
    loop();
    //requestAnimationFrame(loop);
    
    console.log("this is working :D");
}
