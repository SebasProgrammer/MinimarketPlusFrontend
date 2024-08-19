$(function () {
    const video = $("video")[0];
    var model;
    var confidenceThreshold = 0.50; // Set your confidence threshold here
    var currentStream; // Variable to hold the current stream

    // Products data
    const products = [
        { id: 1, name: "Halls", price: 2.0 },
        { id: 2, name: "Heineken", price: 6.0 },
        { id: 3, name: "incakola", price: 3.0 },
        { id: 4, name: "Lays", price: 3.0 },
        { id: 5, name: "Monster", price: 8.40 },
        { id: 6, name: "redbull", price: 8.90 },
        { id: 7, name: "Snickers", price: 5.30 },
        { id: 8, name: "Sprite", price: 2.70 },
        { id: 9, name: "Trident", price: 1.90 },
        { id: 10, name: "pringles_original", price: 10.90 }
    ];

    // Helper function to get product price by name
    function getProductPrice(name) {
        const product = products.find(p => p.name === name);
        return product ? product.price : 0;
    }

    // Create and append a styled dropdown list and buttons for camera control
    $("body").prepend(`
        <div style="position: fixed; top: 20px; left: 5px; z-index: 1001; font-family: Arial, sans-serif;">
            <label for="cameraSelect" style="font-weight: bold; color: #fff; margin-right: 10px;">Select Camera:</label>
            <br><br>
            <select id="cameraSelect" style="padding: 8px 3px; border-radius: 5px; border: none; background-color: #333; color: #fff; cursor: pointer; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);"></select>
            <br><br>
            <button id="cameraOn" style="padding: 8px 16px; border-radius: 5px; border: none; background-color: #4CAF50; color: #fff; cursor: pointer; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);">Encender Cámara</button>
            <br><br>
            <button id="cameraOff" style="padding: 8px 16px; border-radius: 5px; border: none; background-color: #ff4d4d; color: #fff; cursor: pointer; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);">Apagar Cámara</button>
        </div>
    `);

    const cameraSelect = $("#cameraSelect");
    const cameraOn = $("#cameraOn");
    const cameraOff = $("#cameraOff");

    // Function to start the video stream with the selected camera
    function startVideoStream(deviceId) {
        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                deviceId: deviceId
            }
        }).then(function (stream) {
            currentStream = stream; // Store the stream
            video.srcObject = stream;
            video.onloadeddata = function () {
                video.play();
            };
        }).catch(function (error) {
            console.error("Error accediendo a la camara:", error);
        });
    }

    // Function to stop the video stream
    function stopVideoStream() {
        if (currentStream) {
            const tracks = currentStream.getTracks();
            tracks.forEach(track => track.stop()); // Stop each track
            video.srcObject = null; // Clear the video element's source
            currentStream = null; // Clear the current stream variable
        }
    }

    // Function to handle turning on the camera
    function turnOnCamera() {
        const selectedDeviceId = cameraSelect.val();
        if (selectedDeviceId && !currentStream) {
            startVideoStream(selectedDeviceId);
        }
    }

    // Step 1: Enumerate devices and populate the dropdown list
    navigator.mediaDevices.enumerateDevices().then(function (devices) {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        // Populate the camera selection dropdown
        videoDevices.forEach((device, index) => {
            cameraSelect.append(new Option(device.label || `Camera ${index + 1}`, device.deviceId));
        });

        // Start with the first camera by default
        if (videoDevices.length > 0) {
            startVideoStream(videoDevices[0].deviceId);
        }
    });

    // Listen for changes in the camera selection
    cameraSelect.on('change', function () {
        const selectedDeviceId = cameraSelect.val();
        startVideoStream(selectedDeviceId);
    });

    // Listen for the camera on button click
    cameraOn.on('click', function () {
        turnOnCamera();
    });

    // Listen for the camera off button click
    cameraOff.on('click', function () {
        stopVideoStream();
    });

    // Load the model and start detection
    var publishable_key = "rf_piBGXiJtTJUwMWMSR9Dy5g9N1Tv1";
    var toLoad = {
        model: "tesis-vy7o6",
        version: 4
    };

    const loadModelPromise = new Promise(function (resolve, reject) {
        roboflow
            .auth({
                publishable_key: publishable_key
            })
            .load(toLoad)
            .then(function (m) {
                model = m;
                resolve();
            });
    });

    loadModelPromise.then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        var videoRatio = video.videoWidth / video.videoHeight;
        var width = video.offsetWidth,
            height = video.offsetHeight;
        var elementRatio = width / height;

        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };

    const renderPredictions = function (predictions) {
        var dimensions = videoDimensions(video);
        var scale = 1;
        var totalPrice = 0; // Initialize total price

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Clear the sidebar list
        $("#detected-objects").empty();

        const currentTime = new Date();
        const currentHour = currentTime.getUTCHours() - 5; // Adjust UTC to Peruvian time
        const currentMinute = currentTime.getUTCMinutes();

        let heinekenDetected = false;

        predictions.forEach(function (prediction) {
            if (prediction.confidence >= confidenceThreshold) { // Filter by confidence
                const x = prediction.bbox.x;
                const y = prediction.bbox.y;

                const width = prediction.bbox.width;
                const height = prediction.bbox.height;

                ctx.strokeStyle = prediction.color;
                ctx.lineWidth = 4;
                ctx.strokeRect(
                    (x - width / 2) / scale,
                    (y - height / 2) / scale,
                    width / scale,
                    height / scale
                );

                ctx.fillStyle = prediction.color;
                const textWidth = ctx.measureText(prediction.class).width;
                const textHeight = parseInt(font, 10);
                ctx.fillRect(
                    (x - width / 2) / scale,
                    (y - height / 2) / scale,
                    textWidth + 8,
                    textHeight + 4
                );

                // Get the price of the detected product
                const price = getProductPrice(prediction.class);
                if (price > 0) {
                    totalPrice += price; // Accumulate total price
                }

                // Add the object to the sidebar list
                $("#detected-objects").append(`
                    <li style="color: ${prediction.color}; margin: 10px 0;">${prediction.class} (${Math.round(prediction.confidence * 100)}%)</li>
                `);

                // Check if it's after 11:00 PM and the detected object is "Heineken"
                if (prediction.class === "Heineken" && (currentHour >= 12 || (currentHour === 11 && currentMinute >= 0))) {
                    // Display warning
                    $("body").append(`
                        <div id="heineken-warning" style="position: fixed; bottom: 20px; left: 20px; background-color: rgba(255, 0, 0, 0.8); color: white; padding: 10px; border-radius: 5px; z-index: 1002; font-family: Arial, sans-serif;">
                            Prohibido bebidas alcohólicas después de 11:00 PM
                        </div>
                    `);
                    
                    // Hide warning after 5 seconds
                    setTimeout(function () {
                        $("#heineken-warning").remove();
                    }, 5000); // 5000 milliseconds = 5 seconds
                }
            }
        });

        // Update the sidebar with the total price
        $("#total-price").text(`Precio Total: $${totalPrice.toFixed(2)}`);

        predictions.forEach(function (prediction) {
            if (prediction.confidence >= confidenceThreshold) { // Filter by confidence
                const x = prediction.bbox.x;
                const y = prediction.bbox.y;

                const width = prediction.bbox.width;
                const height = prediction.bbox.height;

                ctx.font = font;
                ctx.textBaseline = "top";
                ctx.fillStyle = "#000000";
                ctx.fillText(
                    prediction.class,
                    (x - width / 2) / scale + 4,
                    (y - height / 2) / scale + 1
                );
            }
        });
    };

    var prevTime;
    var pastFrameTimes = [];
    const detectFrame = function () {
        if (!model) return requestAnimationFrame(detectFrame);

        model
            .detect(video)
            .then(function (predictions) {
                requestAnimationFrame(detectFrame);
                renderPredictions(predictions);

                if (prevTime) {
                    pastFrameTimes.push(Date.now() - prevTime);
                    if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                    var total = 0;
                    _.each(pastFrameTimes, function (t) {
                        total += t / 1000;
                    });

                    var fps = pastFrameTimes.length / total;
                    $("#fps").text(Math.round(fps));
                }
                prevTime = Date.now();
            })
            .catch(function (e) {
                console.log("CAUGHT", e);
                requestAnimationFrame(detectFrame);
            });
    };

    // Add a floating sidebar with centered text
    $("body").append(`
        <div id="sidebar" style="position: fixed; right: 0; top: 0; width: 250px; height: 100%; background-color: rgba(255, 255, 255, 0.1); overflow-y: auto; padding: 10px; box-shadow: -2px 0 5px rgba(0,0,0,0.2); z-index: 1000;">
            <h3 style="text-align: center;">Productos Detectados</h3>
            <ul id="detected-objects" style="list-style: none; padding: 0; margin: 0; text-align: center;"></ul>
            <div id="total-price" style="text-align: center; margin-top: 20px; font-weight: bold;"></div>
        </div>
    `);
});
