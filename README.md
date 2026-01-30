# QMail: The Quantum-Secure Email Framework

<p align="center">
<strong>The First Desktop Email Client Architected for the Post-Quantum Era.</strong><br/>
<em>A high-fidelity software implementation of quantum-secure communication protocols.</em>
</p>

<p align="center">
<img alt="Client" src="https://img.shields.io/badge/client-Electron%20%7C%20React-blueviolet">
<img alt="Server" src="https://img.shields.io/badge/server-FastAPI%20%7C%20Python-success">
<img alt="Security" src="https://img.shields.io/badge/security-MF--QKD%20%7C%20PQC-red">
<img alt="Transport" src="https://img.shields.io/badge/transport-HTTPS%20%7C%20WebSocket-orange">
</p>

## The Problem: "Harvest Now, Decrypt Later"

Today's standard encryption (like RSA) relies on mathematical problems that are difficult for classical computers but trivial for future quantum computers. This creates a critical threat: attackers can harvest encrypted traffic today and store it. In 10-20 years, when a powerful quantum computer is built, they can decrypt this data, revealing all past secrets.

**QMail directly confronts this threat with a "Quantum-Ready" architecture.**

## What is QMail?

QMail is a research-grade desktop email client that implements a novel **Software-Defined QKD Framework**. It functions as a sophisticated security layer that integrates seamlessly on top of existing email services like Gmail.

Unlike standard encryption tools, QMail simulates the physics of **Quantum Key Distribution (QKD)** in software, providing a practical testbed for the "Unconditional Security" model while utilizing **Post-Quantum Cryptography (PQC)** to secure the transport layer today.

## Core Innovations

QMail introduces a **Defense-in-Depth** architecture comprising four key innovations:

### 1. The MF-QKD Protocol (Multi-Factor QKD)

Our proprietary enhancement of the BB84 protocol.

- **Concept**: Encodes information across multiple independent quantum properties (e.g., Polarization and Orbital Angular Momentum).
- **Benefit**: Increases the sensitivity to eavesdropping. An attacker must guess multiple basis settings simultaneously, drastically increasing the detectable error rate (QBER) compared to standard protocols.
- **Privacy Amplification**: Implements Stochastic Seed Distillation to ensure the final key is mathematically uncorrelated with any partial information leaked during transmission.

### 2. Hybrid Store-and-Forward Handshake

Solves the "Synchronicity Problem." Standard QKD requires both parties to be online simultaneously.

- **Solution**: A signaling-based state machine that buffers the intent to communicate without buffering the secret keys.
- **Benefit**: Enables QKD-style security over asynchronous networks like email.

### 3. "Fetch-to-RAM" Secure Configuration

Mitigates Static Analysis and Reverse Engineering.

- **Mechanism**: The critical STATE_MAP (the "physics rules" translating bits to states) is not hardcoded in the source code. It is fetched securely from the server upon authentication and stored only in volatile RAM.
- **Benefit**: Stealing the source code or the binary does not reveal the encoding logic. The security configuration vanishes when the app is closed.

### 4. Multi-Layer Security Architecture

Comprehensive security design with defense-in-depth principles.

- **Zero-Knowledge Server**: The server acts as a blind relay and never possesses encryption keys or private random bits.
- **Perfect Forward Secrecy**: Keys are destroyed immediately after use, ensuring past communications remain secure even if future keys are compromised.

## Feature Overview

### Security & Cryptography

**Tiered Security Model:**
- **Level 1 & 2 (MF-QKD)**: Unconditionally secure simulation (One-Time Pad / AES-256).
- **Level 3 (PQC)**: Pure software protection using NIST-standardized algorithms.
- **Level 4 (BB84)**: Standard QKD simulation.

**Zero-Knowledge Architecture**: Keys are generated locally on the client. The server acts as a blind relay and never possesses the keys or the private random bits.

**Decrypt-on-Receive**: Decryption happens instantly upon receipt, and the key is immediately destroyed to ensure Perfect Forward Secrecy.

### User Experience

- **Real-Time Sync**: WebSockets trigger instant inbox refreshes when secure mail arrives.
- **Visual Handshake**: An engaging animation visualizes the quantum negotiation steps (Sifting, Distillation).
- **Proof of Security**: Users can verify the ciphertext in their standard Gmail web interface.

## Architecture

- **Client**: Electron + React. Uses a Local SQLite Cache with isolated paths for multi-user testing.
- **Server**: Python FastAPI + Socket.IO.
- **Proxy**: Nginx with Open Quantum Safe (OQS) module for Kyber-768 TLS termination. [Future production plan]
- **Database**: Supabase (PostgreSQL).

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.8+ and pip
- A Supabase account (for the database and user auth)
- A Google Cloud Platform account (to enable Gmail API and get OAuth2 credentials)

### 1. Server Setup

```bash
# Navigate to the server directory
cd server

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

# Create a .env file in the /server directory and fill in your credentials
# (See .env.example for the required variables)
cp .env.example .env
nano .env # Or use your favorite editor

# Run the FastAPI server
uvicorn app.main:app_asgi --reload
```

The server will be running at http://localhost:8000.

### 2. Client Setup

To simulate two users (Alice and Bob) on one machine, we use distinct ports and isolated databases.

**Terminal 1 (Alice):**

```bash
cd client
npm install
npm run dev:electron  # Runs on Port 5173
```

**Terminal 2 (Bob):**

```bash
cd client
npm run dev:electron2 # Runs on Port 5174 with isolated UserData
```

> **Note**: The `dev:electron2` script automatically creates a separate SQLite database folder to prevent conflicts during local testing.

## Research & Publications

This project is the reference implementation for the research paper:

**"MF-QKD: A Multi-Factor Quantum Key Distribution Protocol with Privacy Amplification for Asynchronous Networks"**  
*TechRxiv, 2025.*

## Future Work

- **Quantum-Hardened Transport (PQC-TLS)**: Implementing a Hybrid Post-Quantum TLS tunnel using Kyber-768 key exchange via Open Quantum Safe. This will wrap simulation traffic in quantum-resistant encryption to mitigate "Harvest Now, Decrypt Later" threats. The production deployment will run the FastAPI backend behind a Quantum-Safe Nginx Proxy with Docker containerization.
- **Mobile Client**: Porting the Store-and-Forward logic to React Native.

## Author

**Mahavishnu K**  
[Visit Portfolio](https://mahavishnu-k.vercel.app/)

---

<p align="center">
<em>Built with ❤️ for a Quantum-Safe Future</em>
</p>
