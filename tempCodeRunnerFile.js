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