/**
 * qkdDemo.js - Visual Demo of QKD Handshake with Eve Interception
 * Run: node qkdDemo.js
 */

// --- CONFIGURATION CONSTANTS ---
const QBER_THRESHOLDS = {
    'BB84': 0.15,
    'MF-QKD': 0.08
};
const SAMPLE_SIZE = 0.5;
const PHOTON_MULTIPLIER = 10;

// --- STATE MAP (Photon Polarization) ---
const STATE_MAP = { '00': 0, '10': 1, '01': 2, '11': 3 };
const INVERSE_STATE_MAP = {
    0: { bit: 0, basis: 0 },
    1: { bit: 1, basis: 0 },
    2: { bit: 0, basis: 1 },
    3: { bit: 1, basis: 1 }
};

// --- HELPER FUNCTIONS ---
const _generateRandomArray = (len) =>
    Array.from({ length: len }, () => Math.round(Math.random()));

function _alicePreparesData(numPhotons, protocol) {
    const bits = _generateRandomArray(numPhotons);
    const bases = _generateRandomArray(numPhotons);
    const orientations = protocol === 'MF-QKD' ? _generateRandomArray(numPhotons) : null;
    const photon_states = bits.map((bit, i) => STATE_MAP[`${bit}${bases[i]}`]);
    return { privateData: { bits, bases, orientations }, publicPayload: { photon_states } };
}

function _bobMeasuresData(receivedStates, protocol) {
    const numPhotons = receivedStates.length;
    const bobPrivate = {
        bases: _generateRandomArray(numPhotons),
        orientations: protocol === 'MF-QKD' ? _generateRandomArray(numPhotons) : null,
        measuredBits: [],
    };
    for (let i = 0; i < numPhotons; i++) {
        const receivedStateInfo = INVERSE_STATE_MAP[receivedStates[i]];
        const basisMatch = bobPrivate.bases[i] === receivedStateInfo.basis;
        if (basisMatch) {
            bobPrivate.measuredBits.push(receivedStateInfo.bit);
        } else {
            bobPrivate.measuredBits.push(Math.round(Math.random()));
        }
    }
    return bobPrivate;
}

// 🔴 Eve Intercepts photons, measures in random basis, and resends altered states
function _eveInterception(photonStates, protocol) {
    const interceptedBases = _generateRandomArray(photonStates.length);
    const interceptedOrientations = protocol === "MF-QKD" ? _generateRandomArray(photonStates.length) : null;

    // Eve measures like Bob would
    const eveMeasuredBits = [];
    for (let i = 0; i < photonStates.length; i++) {
        const receivedStateInfo = INVERSE_STATE_MAP[photonStates[i]];
        const basisMatch = interceptedBases[i] === receivedStateInfo.basis;
        if (basisMatch) {
            eveMeasuredBits.push(receivedStateInfo.bit);
        } else {
            eveMeasuredBits.push(Math.round(Math.random()));
        }
    }

    // Eve resends photons (but they may be corrupted due to basis mismatch)
    const resentPhotonStates = eveMeasuredBits.map(
        (bit, i) => STATE_MAP[`${bit}${interceptedBases[i]}`]
    );

    return resentPhotonStates;
}

function _getSiftIndices(myBases, theirBases, myOrientations, theirOrientations, protocol) {
    const indices = [];
    for (let i = 0; i < myBases.length; i++) {
        const basisMatch = myBases[i] === theirBases[i];
        const orientationMatch = protocol === 'BB84' || (myOrientations[i] === theirOrientations[i]);
        if (basisMatch && orientationMatch) indices.push(i);
    }
    return indices;
}

function _getSiftedKey(privateBits, siftIndices) {
    return siftIndices.map(i => privateBits[i]);
}

function _performErrorCheck(mySiftedKey, theirSample) {
    let mismatches = 0;
    const sampleIndices = new Set();
    for (const { i, val } of theirSample) {
        sampleIndices.add(i);
        if (mySiftedKey[i] !== val) mismatches++;
    }
    const qber = (theirSample.length > 0) ? (mismatches / theirSample.length) : 0;
    const finalKey = mySiftedKey.filter((bit, index) => !sampleIndices.has(index));
    return { finalKey, qber };
}

// --- DEMO HANDSHAKE ---
function runQKD(protocol = "BB84", keyLengthBits = 8, eveInvolved = false) {
    console.log(`\n🔐 Running ${protocol} QKD Handshake ${eveInvolved ? "WITH Eve 🕵" : "WITHOUT Eve"}...\n`);

    const numPhotons = keyLengthBits * PHOTON_MULTIPLIER;
    const { privateData: alicePrivate, publicPayload } = _alicePreparesData(numPhotons, protocol);

    // Eve interception
    let transmittedPhotons = publicPayload.photon_states;
    if (eveInvolved) {
        transmittedPhotons = _eveInterception(transmittedPhotons, protocol);
    }

    const bobPrivate = _bobMeasuresData(transmittedPhotons, protocol);

    // --- Per-bit handshake log ---
    console.log("📡 Handshake trace (photon by photon):\n");
    for (let i = 0; i < numPhotons; i++) {
        const aliceBit = alicePrivate.bits[i];
        const aliceBasis = alicePrivate.bases[i];
        const aliceOri = protocol === "MF-QKD" ? alicePrivate.orientations[i] : "-";

        const eveInfo = eveInvolved ? "⚠ Eve modified" : "";

        const bobBasis = bobPrivate.bases[i];
        const bobOri = protocol === "MF-QKD" ? bobPrivate.orientations[i] : "-";
        const bobMeasured = bobPrivate.measuredBits[i];

        console.log(
            `Photon ${i + 1}: A(bit=${aliceBit}, basis=${aliceBasis}, ori=${aliceOri}) ` +
            `${eveInfo} → B(basis=${bobBasis}, ori=${bobOri}, measured=${bobMeasured})`
        );
    }

    // --- Sifting process ---
    const siftIndices = _getSiftIndices(
        alicePrivate.bases, bobPrivate.bases,
        alicePrivate.orientations, bobPrivate.orientations, protocol
    );
    const aliceSiftedKey = _getSiftedKey(alicePrivate.bits, siftIndices);
    const bobSiftedKey = _getSiftedKey(bobPrivate.measuredBits, siftIndices);

    console.log("\n🔎 Sifting results:");
    console.log("Indices kept:", siftIndices);
    console.log("Alice sifted key:", aliceSiftedKey.join(""));
    console.log("Bob sifted key:  ", bobSiftedKey.join(""));

    // Error check
    const numSamples = Math.floor(aliceSiftedKey.length * SAMPLE_SIZE);
    const sampleIndices = Array.from(Array(aliceSiftedKey.length).keys())
        .sort(() => 0.5 - Math.random())
        .slice(0, numSamples);
    const errorCheckSample = sampleIndices.map(i => ({ i, val: aliceSiftedKey[i] }));

    const { finalKey, qber } = _performErrorCheck(bobSiftedKey, errorCheckSample);
    console.log(`\n📊 QBER: ${(qber * 100).toFixed(2)}%`);

    if (qber > QBER_THRESHOLDS[protocol]) {
        console.log(`"🚨 SECURITY ALERT: High error rate! Possible eavesdropper detected."`);
    } else {
        console.log("✅ Secure key established!");
        console.log("Final Shared Key (binary):", finalKey.join(""));
    }
}

// --- RUN DEMO ---
runQKD("BB84", 16, false); // Normal
runQKD("BB84", 16, true);  // With Eve
runQKD("MF-QKD", 16, false); // Normal
runQKD("MF-QKD", 16, true);  // With Eve