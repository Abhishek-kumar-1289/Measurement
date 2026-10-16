function calculateAttenuation() {
    var fiber = document.getElementById("fiber").value;
    var length = parseFloat(document.getElementById("length").value);
    var inputPower = parseFloat(
        document.getElementById("inputPower").value
    );

    var outputPower = parseFloat(
        document.getElementById("outputPower").value
    );
    if (length <= 0 || inputPower <= 0 || outputPower <= 0) {
        document.getElementById("attenuationResult").innerHTML =
            "Please enter valid values.";
        return;
    }

    var attenuation =
        (10 / length) *
        Math.log10(inputPower / outputPower);

    var fiberName;
    if (fiber == "single") {
        fiberName = "Single Mode Fiber";
    } else {
        fiberName = "Multimode Fiber";
    }

    document.getElementById("attenuationResult").innerHTML =
        "Fiber: " + fiberName +
        "<br>Attenuation = " +
        attenuation.toFixed(2) +
        " dB/km";
}

function calculateBendingLoss() {
    var radius = parseFloat(
        document.getElementById("radius").value
    );

    var straightPower = parseFloat(
        document.getElementById("straightPower").value
    );

    var bentPower = parseFloat(
        document.getElementById("bentPower").value
    );

    if (radius <= 0 || straightPower <= 0 || bentPower <= 0) {

        document.getElementById("bendingResult").innerHTML =
            "Please enter valid values.";
        return;
    }

    var bendingLoss =
        10 * Math.log10(
            straightPower / bentPower
        );
    document.getElementById("bendingResult").innerHTML =
        "Bend Radius: " +
        radius +
        " mm" +
        "<br>Bending Loss = " +
        bendingLoss.toFixed(2) +
        " dB";
}
