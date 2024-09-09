$(function () {
    const video = $("video")[0];
    let model;
    let currentStream = null;
    let selectedDeviceId = null;
    const confidenceThreshold = 0.65; // Set the confidence threshold here (0 to 1)

    const publishable_key = "rf_smbYDdLnlBMPgvuTzYQcWeysNtk1";
    const toLoad = {
        model: "tp2-tkyhk",
        version: 6,
    };

    // Products data
    const products = [
        { id: 1, name: "Halls", price: 2.0 },
        { id: 2, name: "Heineken", price: 6.0 },
        { id: 3, name: "Incakola", price: 3.0 },
        { id: 4, name: "Lays", price: 3.0 },
        { id: 5, name: "Monster", price: 8.40 },
        { id: 6, name: "Redbull", price: 8.90 },
        { id: 7, name: "Snickers", price: 5.30 },
        { id: 8, name: "Sprite", price: 2.70 },
        { id: 9, name: "Trident", price: 1.90 },
        { id: 10, name: "Pringles", price: 10.90 }
    ];

    // Function to get product price by name
    const getProductPrice = (name) => {
        console.log(`Looking up price for: ${name}`);
        const product = products.find(p => p.name.toLowerCase() === name.toLowerCase());
        console.log(`Found product: ${product}`);
        return product ? product.price : 0;
    };

    // Function to check if current time in Lima is past 11 PM
    const isPast11PMInLima = () => {
        const now = new Date();
        const options = { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false };
        const time = new Intl.DateTimeFormat('es-PE', options).format(now);
        const [hour] = time.split(':').map(Number);
        return hour >= 23 && hour<=7;
    };

    // Function to start the video stream based on the selected camera
    const startVideoStream = (deviceId) => {
        const constraints = {
            audio: false,
            video: {
                facingMode: "environment", // Default to front-facing camera
                deviceId: deviceId ? { exact: deviceId } : undefined,
            },
        };
    
        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
        }
    
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                video.srcObject = stream;
                currentStream = stream;
                video.play();
            })
            .catch((error) => console.error("Error accessing media devices:", error));
    };
    
    const populateCameraList = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter((device) => device.kind === "videoinput");
            const cameraSelect = $("#cameraDropdown");
            cameraSelect.empty();

            videoDevices.forEach((device) => {
                const option = new Option(device.label || "Unnamed Camera", device.deviceId);
                cameraSelect.append(option);
            });

            selectedDeviceId = videoDevices[0]?.deviceId;
            if (selectedDeviceId) {
                startVideoStream(selectedDeviceId);
            }
        } catch (error) {
            console.error("Error enumerating devices:", error);
        }
    };

    $("#cameraDropdown").on("change", function () {
        selectedDeviceId = $(this).val();
        startVideoStream(selectedDeviceId);
    });

    // Load the Roboflow model
    const loadModelPromise = new Promise(function (resolve, reject) {
        roboflow
            .auth({ publishable_key: publishable_key })
            .load(toLoad)
            .then(function (m) {
                model = m;
                resolve();
            });
    });

    // Start video stream and load the model
    Promise.all([loadModelPromise]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    // Populate camera list on page load
    populateCameraList();

    // Resize and manage canvas rendering
    let canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        const videoRatio = video.videoWidth / video.videoHeight;
        let width = video.offsetWidth,
            height = video.offsetHeight;
        const elementRatio = width / height;

        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height,
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();
        canvas = $("<canvas/>");
        ctx = canvas[0].getContext("2d");

        const dimensions = videoDimensions(video);
        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2,
        });

        $("body").append(canvas);
    };

    const renderPredictions = function (predictions) {
        const dimensions = videoDimensions(video);
        const scale = 1;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Clear and update the sidebar
        $("#productList").empty();
        let totalPrice = 0;

        predictions.forEach(function (prediction) {
            if (prediction.confidence >= confidenceThreshold) {
                // Skip Heineken if it's past 11 PM in Lima
                if (prediction.class.toLowerCase() === 'heineken' && isPast11PMInLima()) {
                    alert("Desde las 11 PM ya no se puede consumir bebidas alcohólicas.");
                    return; // Skip this product
                }

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

                // Get product price by name
                const price = getProductPrice(prediction.class);
                console.log(`Detected ${prediction.class} with price ${price}`);
                totalPrice += price;

                // Add product to sidebar
                if (price > 0) {
                    $("#productList").append(`<li>${prediction.class}: $${price.toFixed(2)}</li>`);
                }

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

        // Update total price
        $("#totalPrice").text(`Precio Total: $${totalPrice.toFixed(2)}`);
    };

    let prevTime;
    const pastFrameTimes = [];
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

                    const total = pastFrameTimes.reduce((sum, t) => sum + t / 1000, 0);
                    const fps = pastFrameTimes.length / total;
                    $("#fps").text(Math.round(fps));
                }
                prevTime = Date.now();
            })
            .catch(function (e) {
                console.log("CAUGHT", e);
                requestAnimationFrame(detectFrame);
            });
    };

    async function stopVideoStream() {
        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
            currentStream = null;
        }
        video.srcObject = null;
    }

    async function startVideoStreamAsync() {
        const constraints = {
            audio: false,
            video: {
                facingMode: "user",
            },
        };

        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            currentStream = stream;
            video.play();
        } catch (error) {
            console.error("Error accessing media devices:", error);
        }
    }

    $('#cameraSelectBox').on('change', async function() {
        const selectedValue = $(this).val();
        
        if (selectedValue === 'on') {
            console.log("Cámara Prendida");
            try {
                await startVideoStreamAsync(); // Usa async/await para manejar operaciones asíncronas
            } catch (error) {
                console.error("Error al iniciar la cámara:", error);
            }
        } else if (selectedValue === 'off') {
            console.log("Cámara Apagada");
            stopVideoStream(); // Puede ser síncrono si no involucra operaciones que llevan tiempo
        }
    });
});
