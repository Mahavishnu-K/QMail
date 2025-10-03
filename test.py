import random

def alice_prepares_photons(num_photons):
    """Alice generates her random bits and bases."""
    bits = [random.randint(0, 1) for _ in range(num_photons)]
    bases = [random.randint(0, 1) for _ in range(num_photons)]
    
    # "Photons" are just a representation of the bit encoded in a specific basis
    photons = list(zip(bits, bases))
    
    print(f"Alice: Prepared {num_photons} photons.")
    # In a real system, she would send these one by one. Here, we return the whole sequence.
    return bits, bases, photons

def quantum_channel(photons, eve_interception_rate=0.0):
    """
    Simulates photons traveling from Alice to Bob.
    Eve can intercept and measure a fraction of them.
    """
    intercepted_photons = []
    for bit, basis in photons:
        if random.random() < eve_interception_rate:
            # Eve intercepts! She must guess a basis to measure.
            eve_basis = random.randint(0, 1)
            
            # If Eve's basis matches Alice's, the state is unchanged.
            # If not, her measurement randomizes the bit! This is the key insight.  
            if basis != eve_basis:
                measured_bit = random.randint(0, 1) # State collapses to a random outcome
            else:
                measured_bit = bit # Eve gets the correct bit
            
            # Eve resends a new photon with her measurement result and basis.
            intercepted_photons.append((measured_bit, eve_basis))
            print("Eve: Intercepted a photon!")
        else:
            # Photon passes through untouched
            intercepted_photons.append((bit, basis))
            
    return intercepted_photons

def bob_measures_photons(photons):
    """Bob generates his own random bases and measures the incoming photons."""
    num_photons = len(photons)
    bob_bases = [random.randint(0, 1) for _ in range(num_photons)]
    bob_results = []
    
    for i in range(num_photons):
        alice_bit, alice_basis = photons[i]
        
        if alice_basis == bob_bases[i]:
            # Bases match! Bob's result is the same as Alice's bit.
            bob_results.append(alice_bit)
        else:
            # Bases don't match. Quantum mechanics says the result is random.
            bob_results.append(random.randint(0, 1))
            
    print("Bob: Measured all photons.")
    return bob_bases, bob_results

def sift_keys(alice_bases, bob_bases, alice_bits, bob_results):
    """Alice and Bob compare bases and keep only the bits where bases matched."""
    sifted_key_alice = []
    sifted_key_bob = []
    
    for i in range(len(alice_bases)):
        if alice_bases[i] == bob_bases[i]:
            sifted_key_alice.append(alice_bits[i])
            sifted_key_bob.append(bob_results[i])
            
    return sifted_key_alice, sifted_key_bob

def estimate_error_rate(key1, key2, sample_size=0.5):
    """They compare a sample of their sifted keys to detect Eve."""
    num_samples = int(len(key1) * sample_size)
    if num_samples == 0:
        return 0.0, [], []
        
    sample_indices = random.sample(range(len(key1)), num_samples)
    mismatches = 0
    
    for i in sample_indices:
        if key1[i] != key2[i]:
            mismatches += 1
    
    # Remove the publicly revealed sample bits from the final key
    final_key1 = [bit for i, bit in enumerate(key1) if i not in sample_indices]
    final_key2 = [bit for i, bit in enumerate(key2) if i not in sample_indices]

    error_rate = mismatches / num_samples if num_samples > 0 else 0
    return error_rate, final_key1, final_key2

def generate_qkd_key(key_length_bits, eve_interception_rate=0.0):
    """Runs the full BB84 simulation to generate a secure key."""
    # We need to generate more photons than the desired key length due to sifting.
    # A good rule of thumb is ~4x for no Eve, maybe ~8-10x with Eve.
    num_photons = key_length_bits * 8 
    
    # 1. Alice prepares and sends photons (potentially intercepted by Eve)
    alice_bits, alice_bases, photons_to_send = alice_prepares_photons(num_photons)
    received_photons = quantum_channel(photons_to_send, eve_interception_rate)
    
    # 2. Bob measures the photons
    bob_bases, bob_results = bob_measures_photons(received_photons)
    
    # 3. Sifting: Alice and Bob publicly compare bases
    sifted_alice, sifted_bob = sift_keys(alice_bases, bob_bases, alice_bits, bob_results)
    
    if len(sifted_alice) < key_length_bits:
        print("!!! Sifted key is too short. Try generating more initial photons.")
        return None # Protocol failed
    
    # 4. Error Estimation: They check for Eve's presence
    error_rate, final_alice, final_bob = estimate_error_rate(sifted_alice, sifted_bob)
    
    print(f"--- QKD Protocol Summary ---")
    print(f"Initial Photons: {num_photons}")
    print(f"Sifted Key Length: {len(sifted_alice)}")
    print(f"Quantum Bit Error Rate (QBER): {error_rate:.2%}")
    
    # Theoretical security threshold: If error rate > 25%, Eve could know everything.
    # In practice, any significant error rate above system noise is an abort.
    if error_rate > 0.10: # 10% threshold
        print("!!! ABORT! High error rate detected. Eavesdropper is present!")
        return None # Key is insecure
        
    # Success!
    # Trim the key to the desired length.
    final_key = final_alice[:key_length_bits]
    
    # Convert list of bits to bytes for the Crypto Engine
    key_bytes = int("".join(map(str, final_key)), 2).to_bytes(key_length_bits // 8, 'big')
    
    print(f"SUCCESS: Generated a secure {len(final_key)}-bit key.")
    return key_bytes

# --- DEMO ---
if __name__ == '__main__':
    print("\n--- Scenario 1: No Eavesdropper ---")
    secure_key_no_eve = generate_qkd_key(key_length_bits=256, eve_interception_rate=0.0)
    if secure_key_no_eve:
        print(f"Generated Key (bytes): {secure_key_no_eve.hex()}")

    print("\n\n--- Scenario 2: With Eavesdropper (30% interception) ---")
    secure_key_with_eve = generate_qkd_key(key_length_bits=256, eve_interception_rate=0.3)
