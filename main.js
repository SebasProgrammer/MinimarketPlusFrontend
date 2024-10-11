$(document).ready(function () {
    const video = $("video")[0];
    let model;
    let currentStream = null;
    let selectedDeviceId = null;
    const confidenceThreshold = 0.50;
    const font = "16px sans-serif"; // Define font here

    const publishable_key = "rf_smbYDdLnlBMPgvuTzYQcWeysNtk1"; // Store securely in environment variables or backend
    const toLoad = {
        model: "tp2-tkyhk",
        version: 17,
    };

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

    const getProductPrice = (name) => {
        const product = products.find(p => p.name.toLowerCase() === name.toLowerCase());
        return product ? product.price : 0;
    };

    const isPast11PMInLima = () => {
        const now = new Date();
        const options = { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false };
        const [hour] = new Intl.DateTimeFormat('es-PE', options).format(now).split(':').map(Number);
        return hour >= 23 || hour < 7;
    };

    const startVideoStream = async (deviceId) => {
        const constraints = {
            audio: false,
            video: {
                facingMode: "environment",
                deviceId: deviceId ? { exact: deviceId } : undefined,
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
            alert("Error accessing camera. Please make sure camera access is allowed.");
            console.error("Error accessing media devices:", error);
        }
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
                await startVideoStream(selectedDeviceId);
            }
        } catch (error) {
            alert("Error enumerating devices. Please check camera permissions.");
            console.error("Error enumerating devices:", error);
        }
    };

    const loadModel = async () => {
        try {
            const m = await roboflow.auth({ publishable_key: publishable_key }).load(toLoad);
            model = m;
        } catch (error) {
            alert("Error loading model. Please try again later.");
            console.error("Error loading model:", error);
        }
    };

    const startApp = async () => {
        try {
            await requestCameraPermission();
            await populateCameraList();
            await loadModel();
            $("body").removeClass("loading");
            resizeCanvas();
            detectFrame();
        } catch (error) {
            console.error("Error starting app:", error);
            alert("Error starting the app. Please check your camera permissions and try again.");
        }
    };

    const requestCameraPermission = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            // Permission granted, stop this stream as we'll start a new one later
            const tracks = await navigator.mediaDevices.getUserMedia({ video: true });
            tracks.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.error("Error requesting camera permission:", error);
            throw new Error("Camera permission denied");
        }
    };

    const videoDimensions = (video) => {
        const videoRatio = video.videoWidth / video.videoHeight;
        let width = video.offsetWidth;
        let height = video.offsetHeight;
        const elementRatio = width / height;

        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    };

    const resizeCanvas = () => {
        $("canvas").remove();
        const canvas = $("<canvas/>");
        const ctx = canvas[0].getContext("2d");

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

    const renderPredictions = (predictions) => {
        const dimensions = videoDimensions(video);
        const scale = 1;
        const ctx = $("canvas")[0].getContext("2d");
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        $("#productList").empty();
        let totalPrice = 0;

        predictions.forEach((prediction) => {
            if (prediction.confidence >= confidenceThreshold) {
                if (prediction.class.toLowerCase() === 'heineken' && isPast11PMInLima()) {
                    alert("Desde las 11 PM ya no se puede consumir bebidas alcohólicas.");
                    return; // Skip this product
                }

                const { x, y, width, height } = prediction.bbox;

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

                const price = getProductPrice(prediction.class);
                if (price > 0) {
                    $("#productList").append(`<li>${prediction.class}: $${price.toFixed(2)}</li>`);
                    totalPrice += price;
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

        $("#totalPrice").text(`Precio Total: $${totalPrice.toFixed(2)}`);
    };

    let prevTime;
    const pastFrameTimes = [];
    const detectFrame = () => {
        if (!model) return requestAnimationFrame(detectFrame);

        model.detect(video).then((predictions) => {
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
        }).catch((error) => {
            console.error("Error detecting frame:", error);
            requestAnimationFrame(detectFrame);
        });
    };

    const stopVideoStream = async () => {
        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
            currentStream = null;
        }
        video.srcObject = null;
    };

    const startVideoStreamAsync = async () => {
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
            console.error("Error starting video stream:", error);
        }
    };

    $('#cameraSelectBox').on('change', async function() {
        const selectedValue = $(this).val();
        if (selectedValue === 'on') {
            try {
                await startVideoStreamAsync();
            } catch (error) {
                console.error("Error starting camera:", error);
            }
        } else if (selectedValue === 'off') {
            await stopVideoStream();
        }
    });

    document.getElementById('logoutIcon').addEventListener('click', function () {
        // Aquí puedes agregar la lógica para cerrar sesión o redirigir al login
        // Por ejemplo, redirigir a una página de login
        window.location.href = 'login.html';
    });

    // Initialize app
    startApp().catch((error) => {
        console.error("Error during initialization:", error);
    });
});
