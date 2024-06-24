/*jshint esversion:6*/

$(function () {
    const video = $("video")[0];

    var model;
    var cameraMode = "environment"; // or "user"
    var confidenceThreshold = 0.75; // Set your confidence threshold here

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: {
                facingMode: cameraMode
            }
        })
        .then(function (stream) {
            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });

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

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
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

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

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
            }
        });

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
});
