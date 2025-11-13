/**
 * qkdDemo.js - Visual Demo of QKD Handshake with Eve Interception
 * This version uses the unified 8-state map for the MF-QKD protocol.
 * Run: node qkdDemo.js
 */

// --- CONFIGURATION CONSTANTS ---
const QBER_THRESHOLDS = { 'BB84': 0.15, 'MF-QKD': 0.08 };
const SAMPLE_SIZE = 0.5;
const PHOTON_MULTIPLIER = 10;

// --- STATE MAPS ---
const STATE_MAP_BB84 = { '00': 0, '10': 1, '01': 2, '11': 3 };
const INVERSE_STATE_MAP_BB84 = {
    0: { bit: 0, basis: 0 }, 1: { bit: 1, basis: 0 },
    2: { bit: 0, basis: 1 }, 3: { bit: 1, basis: 1 }
};

// --- NEW & ENHANCED ---
// The unified 8-state map for your innovative Multi-Factor protocol
const STATE_MAP_MF = {
    '000': 0, '100': 1, '010': 2, '110': 3,
    '001': 4, '101': 5, '011': 6, '111': 7
};
const INVERSE_STATE_MAP_MF = {
    0: { bit: 0, basis: 0, orientation: 0 }, 1: { bit: 1, basis: 0, orientation: 0 },
    2: { bit: 0, basis: 1, orientation: 0 }, 3: { bit: 1, basis: 1, orientation: 0 },
    4: { bit: 0, basis: 0, orientation: 1 }, 5: { bit: 1, basis: 0, orientation: 1 },
    6: { bit: 0, basis: 1, orientation: 1 }, 7: { bit: 1, basis: 1, orientation: 1 }
};

// --- HELPER FUNCTIONS ---
const _generateRandomArray = (len) => Array.from({ length: len }, () => Math.round(Math.random()));

// --- ENHANCED --- Uses the correct state map based on the protocol
function _alicePreparesData(numPhotons, protocol) {
    const bits = _generateRandomArray(numPhotons);
    const bases = _generateRandomArray(numPhotons);
    
    if (protocol === 'MF-QKD') {
        const orientations = _generateRandomArray(numPhotons);
        const photon_states = bits.map((bit, i) => STATE_MAP_MF[`${bit}${bases[i]}${orientations[i]}`]);
        return { privateData: { bits, bases, orientations }, publicPayload: { photon_states } };
    } else { // BB84
        const photon_states = bits.map((bit, i) => STATE_MAP_BB84[`${bit}${bases[i]}`]);
        return { privateData: { bits, bases, orientations: null }, publicPayload: { photon_states } };
    }
}

// --- CORRECTED --- Now correctly checks for orientation match in MF-QKD
function _bobMeasuresData(receivedStates, protocol) {
    const numPhotons = receivedStates.length;
    const inverseMap = protocol === 'MF-QKD' ? INVERSE_STATE_MAP_MF : INVERSE_STATE_MAP_BB84;
    const bobPrivate = {
        bases: _generateRandomArray(numPhotons),
        orientations: protocol === 'MF-QKD' ? _generateRandomArray(numPhotons) : null,
        measuredBits: [],
    };
    for (let i = 0; i < numPhotons; i++) {
        const receivedStateInfo = inverseMap[receivedStates[i]];
        const basisMatch = bobPrivate.bases[i] === receivedStateInfo.basis;
        const orientationMatch = protocol === 'BB84' || (bobPrivate.orientations[i] === receivedStateInfo.orientation);

        if (basisMatch && orientationMatch) {
            bobPrivate.measuredBits.push(receivedStateInfo.bit);
        } else {
            bobPrivate.measuredBits.push(Math.round(Math.random()));
        }
    }
    return bobPrivate;
}

// --- ENHANCED --- Eve's attack now properly handles the MF-QKD protocol
function _eveInterception(photonStates, protocol) {
    const inverseMap = protocol === 'MF-QKD' ? INVERSE_STATE_MAP_MF : INVERSE_STATE_MAP_BB84;
    const stateMap = protocol === 'MF-QKD' ? STATE_MAP_MF : STATE_MAP_BB84;

    const eveBases = _generateRandomArray(photonStates.length);
    const eveOrientations = protocol === "MF-QKD" ? _generateRandomArray(photonStates.length) : null;
    const eveMeasuredBits = [];

    // Eve measures each photon, introducing errors
    for (let i = 0; i < photonStates.length; i++) {
        const receivedStateInfo = inverseMap[photonStates[i]];
        const basisMatch = eveBases[i] === receivedStateInfo.basis;
        const orientationMatch = protocol === 'BB84' || (eveOrientations[i] === receivedStateInfo.orientation);

        if (basisMatch && orientationMatch) {
            eveMeasuredBits.push(receivedStateInfo.bit); // Lucky guess
        } else {
            eveMeasuredBits.push(Math.round(Math.random())); // Unlucky guess, random bit
        }
    }

    // Eve resends new, corrupted photons based on her measurements
    const resentPhotonStates = eveMeasuredBits.map((bit, i) => {
        if (protocol === 'MF-QKD') {
            return stateMap[`${bit}${eveBases[i]}${eveOrientations[i]}`];
        } else {
            return stateMap[`${bit}${eveBases[i]}`];
        }
    });

    return resentPhotonStates;
}

// ... The rest of the functions are unchanged as they were already correct ...
function _getSiftIndices(myBases, theirBases, myOrientations, theirOrientations, protocol) {
    const indices = []; //... (implementation is correct)
    for (let i = 0; i < myBases.length; i++) {
        const basisMatch = myBases[i] === theirBases[i];
        const orientationMatch = protocol === 'BB84' || (myOrientations[i] === theirOrientations[i]);
        if (basisMatch && orientationMatch) indices.push(i);
    }
    return indices;
}
function _getSiftedKey(privateBits, siftIndices) { return siftIndices.map(i => privateBits[i]); }
function _performErrorCheck(mySiftedKey, theirSample) {
    let mismatches = 0; //... (implementation is correct)
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
    console.log(`\n\n======================================================`);
    console.log(`🔐 Running ${protocol} QKD Demo | ${eveInvolved ? "WITH EVE 🕵️" : "Clean Channel"}`);
    console.log(`======================================================`);

    const numPhotons = keyLengthBits * PHOTON_MULTIPLIER;
    const { privateData: alicePrivate, publicPayload } = _alicePreparesData(numPhotons, protocol);
    
    console.log("\n[Step 1: Alice prepares and sends states]");
    
    let transmittedPhotons = publicPayload.photon_states;
    if (eveInvolved) {
        console.log("🔴 EVE INTERCEPTS, MEASURES, AND RESENDS ALTERED STATES!");
        transmittedPhotons = _eveInterception(transmittedPhotons, protocol);
    }

    const bobPrivate = _bobMeasuresData(transmittedPhotons, protocol);
    console.log("[Step 2: Bob receives states and measures them]");

    console.log("\n[Step 3: Public Sifting]");
    const siftIndices = _getSiftIndices(
        alicePrivate.bases, bobPrivate.bases,
        alicePrivate.orientations, bobPrivate.orientations, protocol
    );
    const aliceSiftedKey = _getSiftedKey(alicePrivate.bits, siftIndices);
    const bobSiftedKey = _getSiftedKey(bobPrivate.measuredBits, siftIndices);

    console.log("  - Matching indices found:", siftIndices.length);
    console.log("  - Alice's Sifted Key:", aliceSiftedKey.join(""));
    console.log("  - Bob's Sifted Key:  ", bobSiftedKey.join(""));

    console.log("\n[Step 4: Error Checking]");
    const numSamples = Math.floor(aliceSiftedKey.length * SAMPLE_SIZE);
    const sampleIndices = Array.from(Array(aliceSiftedKey.length).keys()).sort(() => 0.5 - Math.random()).slice(0, numSamples);
    const errorCheckSample = sampleIndices.map(i => ({ i, val: aliceSiftedKey[i] }));
    
    const { finalKey, qber } = _performErrorCheck(bobSiftedKey, errorCheckSample);
    
    console.log(`  - Comparing ${numSamples} sample bits...`);
    console.log(`  - RESULTING QBER: ${(qber * 100).toFixed(2)}%`);

    console.log("\n[Step 5: Final Verdict]");
    if (qber > QBER_THRESHOLDS[protocol]) {
        console.log(`  - 🚨 SECURITY ALERT: QBER exceeds threshold of ${(QBER_THRESHOLDS[protocol]*100)}%. KEY DISCARDED.`);
    } else {
        console.log("  - ✅ QBER is within safe limits. Secure key established!");
        console.log("  - Final Shared Key (binary):", finalKey.join(""));
    }
}

// --- RUN DEMOS ---
runQKD("BB84", 16, false);
runQKD("BB84", 16, true);
runQKD("MF-QKD", 16, false);
runQKD("MF-QKD", 16, true); // The most important test